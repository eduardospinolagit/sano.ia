/**
 * wa-session.ts
 *
 * Uma instância de conexão WhatsApp por tenant.
 * Refatorado de whatsapp.service.ts (SpiceHOT) para ser instanciável.
 *
 * Cada tenant tem seu próprio WASession com:
 *  - Socket Baileys isolado
 *  - Diretório de auth próprio
 *  - Cache de mensagens para reply/quote
 *  - EventEmitter para mensagens recebidas
 */

import path   from 'path'
import { EventEmitter } from 'events'
import type { InboundEvent, WAStatus } from '../types'

// ─── Cache TTL ────────────────────────────────────────────────

const MSG_CACHE_MAX = 300

// ─── Classe WASession ─────────────────────────────────────────

export class WASession {
  private socket:       any | null = null
  private status:       WAStatus   = 'disconnected'
  private qrCode:       string | null = null
  private emitter:      EventEmitter  = new EventEmitter()
  private msgCache =    new Map<string, any>()
  private autoReconnect = false   // só reconecta se explicitamente habilitado

  constructor(
    public readonly tenantId: string,
    private readonly authDir: string
  ) {}

  // ─── Conexão ─────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.socket) {
      try { this.socket.end?.(undefined) } catch { /* ignora */ }
      this.socket = null
    }
    this.autoReconnect = true
    this.status = 'connecting'

    const {
      default: makeWASocket,
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      Browsers,
    } = await import('@whiskeysockets/baileys') as any

    const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir)
    const { version }                     = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth:                           authState,
      printQRInTerminal:              false,
      logger:                         this.silentLogger(),
      browser:                        Browsers.macOS('Desktop'),
      generateHighQualityLinkPreview: false,
      markOnlineOnConnect:            true,
      syncFullHistory:                false,
      fireInitQueries:                false,
      connectTimeoutMs:               60_000,
      keepAliveIntervalMs:            25_000,
      retryRequestDelayMs:            2_000,
    })

    this.socket = sock

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.status = 'qr_pending'
        this.qrCode = qr
        this.emitter.emit('qr', qr)
        console.log(`[WA:${this.tenantId}] QR pronto para escanear`)
      }

      if (connection === 'close') {
        const code               = lastDisconnect?.error?.output?.statusCode
        const isLoggedOut        = code === DisconnectReason.loggedOut
        const isConnectionReplaced = code === 440
        this.status = 'disconnected'
        this.socket = null
        console.log(`[WA:${this.tenantId}] Desconectado (código ${code}).`)

        if (!this.autoReconnect) {
          // desconexão manual — não reconecta
          return
        }

        if (isLoggedOut || isConnectionReplaced) {
          // sessão inválida ou substituída — requer novo QR, não reconecta automaticamente
          this.autoReconnect = false
          console.log(`[WA:${this.tenantId}] Sessão encerrada (${isLoggedOut ? 'logout' : 'conexão substituída'}) — aguardando nova conexão manual.`)
        } else {
          const delay = code === 408 ? 3_000 : 5_000
          console.log(`[WA:${this.tenantId}] Reconectando em ${delay / 1000}s...`)
          setTimeout(() => this.connect().catch(e => console.error(`[WA:${this.tenantId}] Falha ao reconectar:`, e)), delay)
        }
      }

      if (connection === 'open') {
        this.status = 'connected'
        this.qrCode = null
        console.log(`[WA:${this.tenantId}] Conectado!`)
        this.emitter.emit('connected')
      }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.update', (updates: any[]) => {
      for (const u of updates) {
        if (u.key?.fromMe) {
          console.log(`[WA:${this.tenantId}] ACK id=${u.key.id} status=${u.update?.status}`)
        }
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        if (msg.key.fromMe) continue
        if (!msg.message)   continue

        console.log(`[WA:${this.tenantId}] inbound remoteJid=${msg.key.remoteJid}`)

        const event = this.normalizeMessage(msg)
        if (!event) continue

        if (event.wa_message_id) this.cacheMsg(event.wa_message_id, msg)

        this.emitter.emit('message', event)
      }
    })
  }

  disconnect(): void {
    this.autoReconnect = false
    try { this.socket?.end?.(undefined) } catch { /* ignora */ }
    this.socket = null
    this.status = 'disconnected'
    this.qrCode = null
    console.log(`[WA:${this.tenantId}] Desconectado manualmente`)
  }

  // ─── Envio ────────────────────────────────────────────────────

  async sendText(
    phone:            string,
    text:             string,
    waJid?:           string,
    quotedMessageId?: string
  ): Promise<void> {
    this.assertConnected()
    const jid     = waJid ?? `${phone}@s.whatsapp.net`
    const options: any = {}

    if (quotedMessageId) {
      const quoted = this.msgCache.get(quotedMessageId)
      if (quoted) options.quoted = quoted
    }

    const result = await this.socket.sendMessage(jid, { text }, options)
    console.log(`[WA:${this.tenantId}] sendText → jid=${jid} quoted=${!!options.quoted} id=${result?.key?.id}`)
  }

  async sendAudio(
    phone:  string,
    buffer: Buffer,
    waJid?: string
  ): Promise<void> {
    this.assertConnected()
    const jid = waJid ?? `${phone}@s.whatsapp.net`
    await this.socket.sendMessage(jid, {
      audio:    buffer,
      mimetype: 'audio/mpeg',
      ptt:      true,
    })
  }

  // ─── Handlers ────────────────────────────────────────────────

  onMessage(handler: (event: InboundEvent) => Promise<void>): void {
    this.emitter.on('message', handler)
  }

  onQR(handler: (qr: string) => void): void {
    this.emitter.on('qr', handler)
  }

  onConnected(handler: () => void): void {
    this.emitter.on('connected', handler)
  }

  // ─── Status ───────────────────────────────────────────────────

  getStatus(): { status: WAStatus; qrCode: string | null; phone?: string } {
    return { status: this.status, qrCode: this.qrCode }
  }

  isConnected(): boolean {
    return this.status === 'connected' && !!this.socket
  }

  // ─── Helpers privados ─────────────────────────────────────────

  private assertConnected(): void {
    if (!this.isConnected()) {
      throw new Error(`[WA:${this.tenantId}] WhatsApp não está conectado`)
    }
  }

  private cacheMsg(waMessageId: string, rawMsg: any): void {
    if (this.msgCache.size >= MSG_CACHE_MAX) {
      const firstKey = this.msgCache.keys().next().value
      if (firstKey !== undefined) this.msgCache.delete(firstKey)
    }
    this.msgCache.set(waMessageId, rawMsg)
  }

  private normalizeMessage(msg: any): InboundEvent | null {
    const jid = msg.key.remoteJid as string
    if (!jid || jid.includes('@g.us')) return null

    const phone      = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '').replace(/\D/g, '')
    const msgContent = msg.message

    if (msgContent?.conversation || msgContent?.extendedTextMessage?.text) {
      return {
        tenant_id:     this.tenantId,
        phone,
        wa_jid:        jid,
        type:          'text',
        content:       msgContent.conversation ?? msgContent.extendedTextMessage.text,
        wa_message_id: msg.key.id,
      }
    }

    if (msgContent?.audioMessage) {
      return {
        tenant_id:     this.tenantId,
        phone,
        wa_jid:        jid,
        type:          'audio',
        wa_message_id: msg.key.id,
      }
    }

    if (msgContent?.imageMessage) {
      return {
        tenant_id:     this.tenantId,
        phone,
        wa_jid:        jid,
        type:          'image',
        content:       msgContent.imageMessage.caption ?? '',
        wa_message_id: msg.key.id,
      }
    }

    return null
  }

  private silentLogger(): any {
    const noop = () => {}
    const stub: any = {
      level: 'silent', trace: noop, debug: noop, info: noop,
      warn: noop, error: noop, fatal: noop,
    }
    stub.child = () => this.silentLogger()
    return stub
  }
}
