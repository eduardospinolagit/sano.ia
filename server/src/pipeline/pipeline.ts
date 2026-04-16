/**
 * pipeline.ts — Orquestrador multi-tenant do Sano.ia
 *
 * Fluxo por mensagem:
 *  0.  guardrails  → lock, dedup, usuário bloqueado
 *  1.  ingest      → user, conversa, persist inbound
 *  2.  transcription (se áudio)
 *  3.  context     → short-term + knowledge base + memory
 *  4.  behavior    → presence/mood/relationship
 *  5.  llm         → GPT com retry + fallback
 *  6.  delay       → comportamental
 *  7.  delivery    → NLD + envio WA com reply
 *  8.  memory      → extrai fatos async
 */

import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'

import supabase from '../services/supabase.service'
import openai   from '../services/openai.service'

import { logger }           from '../modules/logger/logger.module'
import { ingest }           from '../modules/ingest/ingest.module'
import { buildContext }     from '../modules/context/context.module'
import { generateResponse } from '../modules/llm/llm.module'
import { calculateDelay }   from '../modules/delay/delay.module'
import { deliver }          from '../modules/delivery/delivery.module'
import { runNLD }           from '../modules/nld/nld_runtime'
import {
  waitForConversationLock,
  releaseConversationLock,
  runGuardrails,
  guardEmptyResponse,
} from '../modules/ops/guardrails.engine'
import { detectBusinessEvent, notifyOwner } from '../modules/notifications/notification.module'
import { extractAndSaveMemories }           from '../modules/memory/memory.module'

import type { InboundEvent, BehaviorProfile, EngagementProfile, SafetyProfile } from '../types'
import type { TenantRuntime } from '../tenant/tenant-manager'
import type { NLDContext }    from '../modules/nld/nld_runtime'

// ─── Detecção de pedido de localização ───────────────────────

const LOCATION_KEYWORDS = [
  'localização', 'localizacao', 'endereço', 'endereco', 'onde fica',
  'onde vocês ficam', 'onde voces ficam', 'como chegar', 'mapa',
  'pin', 'maps', 'google maps', 'sua localização', 'sua localizacao',
  'loja fica', 'loja está', 'loja esta', 'fica onde', 'onde estão',
]

function isLocationRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return LOCATION_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── Sleep (23:00–08:00) ──────────────────────────────────────

function isSleepTime(agent: { active_hours_config?: any }): boolean {
  const config = agent.active_hours_config

  // Se configurado como 24h ou sem configuração de horário, sempre ativo
  if (!config || config.always_on === true || config.enabled === false) return false

  const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const h      = now.getHours()
  const m      = now.getMinutes()
  const dayMap = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const day    = dayMap[now.getDay()]
  const dayConfig = config[day] ?? config.days?.[day]

  // Se tem config por dia
  if (dayConfig) {
    if (!dayConfig.available) return true
    const [startH, startM] = (dayConfig.start ?? '00:00').split(':').map(Number)
    const [endH,   endM]   = (dayConfig.end   ?? '23:59').split(':').map(Number)
    const cur   = h * 60 + m
    const start = startH * 60 + startM
    const end   = endH   * 60 + endM
    return cur < start || cur >= end
  }

  // Fallback: nunca bloqueia se tem config mas não tem o dia
  return false
}

// ─── Processamento de documentos ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer, opts?: any) => Promise<{ text: string }> = require('pdf-parse')

async function processDocument(
  mediaUrl:     string | undefined,
  documentName: string | undefined,
  messageId:    string,
  tenantId:     string
): Promise<{ text: string; usedFallback: boolean }> {
  const filename = documentName ?? 'documento'

  if (!mediaUrl || !fs.existsSync(mediaUrl)) {
    return { text: `[O cliente enviou o documento "${filename}" mas não foi possível acessá-lo]`, usedFallback: false }
  }

  try {
    const buffer = fs.readFileSync(mediaUrl)
    const lname  = filename.toLowerCase()

    // ── Texto puro ──────────────────────────────────────────────
    if (lname.endsWith('.txt')) {
      const text = buffer.toString('utf-8').replace(/\s+/g, ' ').trim()
      return { text: `[O cliente enviou o documento "${filename}":\n${text}]`, usedFallback: false }
    }

    // ── PDF ─────────────────────────────────────────────────────
    if (lname.endsWith('.pdf')) {
      // 1. Tenta extração de texto nativo (rápido, gratuito)
      const parsed  = await pdfParse(buffer)
      const extracted = parsed.text?.replace(/\s+/g, ' ').trim()

      if (extracted && extracted.length > 20) {
        await supabase.from('messages').update({ status: 'processed' }).eq('id', messageId)
        console.log(`[PIPELINE:${tenantId}] PDF "${filename}" — texto nativo extraído (${extracted.length} chars)`)
        return { text: `[O cliente enviou o documento "${filename}":\n${extracted}]`, usedFallback: false }
      }

      // 2. PDF escaneado — OCR via pdfjs-dist + OpenAI Vision
      console.log(`[PIPELINE:${tenantId}] PDF "${filename}" sem texto nativo — tentando OCR via Vision`)
      const ocrText = await ocrPdfVision(buffer, filename, tenantId)

      if (ocrText) {
        await supabase.from('messages').update({ status: 'processed' }).eq('id', messageId)
        console.log(`[PIPELINE:${tenantId}] PDF "${filename}" — OCR Vision OK (${ocrText.length} chars)`)
        return { text: `[O cliente enviou o documento "${filename}":\n${ocrText}]`, usedFallback: false }
      }

      // 3. OCR falhou — pede foto
      return {
        text: `[O cliente enviou o PDF "${filename}", mas o arquivo é uma imagem escaneada e não foi possível ler o conteúdo automaticamente. Informe ao cliente de forma gentil e peça que tire uma foto clara do documento e envie pelo WhatsApp para que você possa ajudá-lo.]`,
        usedFallback: false,
      }
    }

    // ── Outro formato ────────────────────────────────────────────
    return {
      text: `[O cliente enviou o arquivo "${filename}". Informe gentilmente que ainda não consegue ler esse tipo de arquivo e pergunte o que ele precisa.]`,
      usedFallback: false,
    }

  } catch (err) {
    console.error(`[PIPELINE:${tenantId}] Erro ao processar documento "${filename}":`, err)
    return { text: `[O cliente enviou o documento "${filename}" mas ocorreu um erro ao processá-lo. Responda normalmente e pergunte o que ele precisa.]`, usedFallback: false }
  } finally {
    if (mediaUrl && fs.existsSync(mediaUrl)) fs.unlinkSync(mediaUrl)
  }
}

async function ocrPdfVision(buffer: Buffer, filename: string, tenantId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createCanvas } = require('canvas')

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
    const pdfDoc      = await loadingTask.promise
    const maxPages    = Math.min(pdfDoc.numPages, 3)

    const allText: string[] = []

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page     = await pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas   = createCanvas(viewport.width, viewport.height)

      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

      const pngBase64 = canvas.toBuffer('image/png').toString('base64')

      const response = await openai.chat.completions.create({
        model:      'gpt-4o',
        max_tokens: 1500,
        messages:   [{
          role:    'user',
          content: [
            { type: 'text',      text: 'Extraia todo o texto deste documento. Retorne apenas o texto extraído, sem comentários.' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}`, detail: 'high' } },
          ] as any,
        }],
      })

      const pageText = response.choices[0]?.message?.content?.trim()
      if (pageText) allText.push(pageText)
    }

    return allText.length > 0 ? allText.join('\n\n') : null
  } catch (err) {
    console.error(`[PIPELINE:${tenantId}] OCR Vision falhou para "${filename}":`, err)
    return null
  }
}

// ─── Descrição de imagens via Vision ─────────────────────────

async function describeImage(
  mediaUrl:  string | undefined,
  caption:   string,
  tenantId:  string
): Promise<string> {
  if (!mediaUrl || !fs.existsSync(mediaUrl)) {
    return caption
      ? `[O usuário enviou uma imagem com legenda: "${caption}"]`
      : '[O usuário enviou uma imagem, mas não foi possível carregá-la]'
  }

  try {
    const buffer  = fs.readFileSync(mediaUrl)
    const base64  = buffer.toString('base64')

    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 500,
      messages:   [{
        role:    'user',
        content: [
          {
            type: 'text',
            text: 'Descreva o conteúdo desta imagem em português de forma objetiva e detalhada. Se houver texto visível, transcreva-o.',
          },
          {
            type:      'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
          },
        ] as any,
      }],
    })

    const desc = response.choices[0]?.message?.content?.trim() ?? 'imagem recebida'
    return caption
      ? `[O usuário enviou uma imagem com legenda "${caption}": ${desc}]`
      : `[O usuário enviou uma imagem: ${desc}]`
  } catch (err) {
    console.error(`[PIPELINE:${tenantId}] Vision falhou:`, err)
    return caption
      ? `[O usuário enviou uma imagem com legenda: "${caption}"]`
      : '[O usuário enviou uma imagem que não pôde ser analisada]'
  } finally {
    if (fs.existsSync(mediaUrl!)) fs.unlinkSync(mediaUrl!)
  }
}

// ─── Transcrição ──────────────────────────────────────────────

async function transcribeAudio(
  mediaUrl:  string | undefined,
  messageId: string,
  userId:    string,
  tenantId:  string
): Promise<{ text: string; usedFallback: boolean }> {
  if (!mediaUrl) {
    return { text: 'Não consegui ouvir o áudio, pode escrever?', usedFallback: true }
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file:     fs.createReadStream(mediaUrl) as any,
      model:    'whisper-1',
      language: 'pt',
    })

    await supabase.from('messages')
      .update({ transcription: transcription.text, status: 'processed' })
      .eq('id', messageId)

    return { text: transcription.text, usedFallback: false }
  } catch (err) {
    console.error(`[PIPELINE:${tenantId}] Transcrição falhou:`, err)
    return { text: 'Não consegui ouvir o áudio, pode escrever?', usedFallback: true }
  } finally {
    if (fs.existsSync(mediaUrl)) fs.unlinkSync(mediaUrl)
  }
}

// ─── Shutdown tracking ────────────────────────────────────────

let _shuttingDown    = false
let _activePipelines = 0

export function markShuttingDown(): void     { _shuttingDown = true }
export function getActivePipelines(): number { return _activePipelines }

export function waitForShutdown(timeoutMs = 10_000): Promise<void> {
  return new Promise(resolve => {
    if (_activePipelines === 0) { resolve(); return }
    const deadline = setTimeout(() => {
      console.warn(`[PIPELINE] Timeout de shutdown — ${_activePipelines} pipeline(s) ainda ativo(s)`)
      resolve()
    }, timeoutMs)
    const check = setInterval(() => {
      if (_activePipelines === 0) {
        clearInterval(check)
        clearTimeout(deadline)
        resolve()
      }
    }, 100)
  })
}

// ─── Pipeline principal ───────────────────────────────────────

export async function runPipeline(
  event:   InboundEvent,
  runtime: TenantRuntime
): Promise<void> {
  if (_shuttingDown) {
    console.log(`[PIPELINE:${runtime.tenant.slug}] Servidor encerrando — mensagem descartada`)
    return
  }

  _activePipelines++
  const { tenant, agent, waSession, currentArcs } = runtime
  const pipelineStart = Date.now()
  let conversationId: string | undefined

  try {
    // ── 0. GUARDRAILS ──────────────────────────────────────────
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, is_blocked')
      .eq('phone', event.phone)
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    const guardrail = await runGuardrails({
      userId:      existingUser?.id ?? 'unknown',
      tenantId:    tenant.id,
      waMessageId: event.wa_message_id,
    })

    if (guardrail.verdict === 'block') {
      console.warn(`[PIPELINE:${tenant.slug}] Guardrail bloqueou: ${guardrail.reason}`)
      return
    }

    // ── 1. INGEST ──────────────────────────────────────────────
    const ctx = await ingest(event, agent, tenant)
    conversationId = ctx.conversation.id

    if (ctx.conversation.status === 'paused') {
      console.log(`[PIPELINE:${tenant.slug}] Conversa pausada — atendimento humano ativo`)
      return
    }

    if (isSleepTime(agent)) {
      console.log(`[PIPELINE:${tenant.slug}] Fora do horário — mensagem salva`)
      return
    }

    const lockAcquired = await waitForConversationLock(ctx.conversation.id)
    if (!lockAcquired) {
      console.warn(`[PIPELINE:${tenant.slug}] Conversa ${ctx.conversation.id} timeout no lock — descartando`)
      return
    }

    // ── 2. TRANSCRIÇÃO / NORMALIZAÇÃO ──────────────────────────
    if (event.type === 'audio') {
      const stt = await transcribeAudio(event.media_url, ctx.inboundMessage.id, ctx.user.id, tenant.id)
      ctx.textContent = stt.text
      if (stt.usedFallback) {
        await waSession.sendText(ctx.user.phone, ctx.textContent, ctx.wa_jid)
        return
      }
    }

    if (event.type === 'document') {
      const doc = await processDocument(event.media_url, event.document_name, ctx.inboundMessage.id, tenant.id)
      ctx.textContent = doc.text
      // Persiste texto extraído para que o watchdog possa retentar sem precisar do arquivo temp
      await supabase.from('messages')
        .update({ content: doc.text })
        .eq('id', ctx.inboundMessage.id)
    }

    if (event.type === 'image') {
      ctx.textContent = await describeImage(event.media_url, event.content ?? '', tenant.id)
    }

    if (event.type === 'location' && event.location) {
      const { lat, lng, name, address } = event.location
      const parts = [`[O usuário enviou uma localização: latitude ${lat}, longitude ${lng}`]
      if (name)    parts.push(`Nome: ${name}`)
      if (address) parts.push(`Endereço: ${address}`)
      parts.push(`Link: https://maps.google.com/?q=${lat},${lng}]`)
      ctx.textContent = parts.join('. ')
    }

    if (!ctx.textContent?.trim()) return

    // ── 3. CONTEXT ─────────────────────────────────────────────
    const { messages } = await buildContext(agent, ctx.conversation, ctx.user, ctx.textContent, tenant.id)

    // ── 4. BEHAVIOR ────────────────────────────────────────────
    // Behavior simplificado — pode ser expandido com os engines do SpiceHOT
    const behaviorProfile: BehaviorProfile = buildDefaultBehavior(agent, ctx.conversation.relationship_level)
    const engagementProfile: EngagementProfile = buildDefaultEngagement()
    const safetyProfile: SafetyProfile = buildDefaultSafety()

    // ── 5. LLM ─────────────────────────────────────────────────
    const llmStart = Date.now()
    let llmResult

    try {
      llmResult = await generateResponse(messages, agent, {
        user_id:         ctx.user.id,
        conversation_id: ctx.conversation.id,
        message_id:      ctx.inboundMessage.id,
      })
    } catch (err) {
      console.error(`[PIPELINE:${tenant.slug}] LLM falhou:`, err)
      await waSession.sendText(ctx.user.phone, 'Um segundo... 🙂', ctx.wa_jid)
      return
    }

    const technicalMs = Date.now() - llmStart

    const emptyGuard = guardEmptyResponse(llmResult.text)
    if (emptyGuard.verdict !== 'allow') {
      llmResult.text = 'hmm, me dá um segundo...'
    }

    // ── 6. DELAY ───────────────────────────────────────────────
    const baseDelay  = calculateDelay('text', ctx.textContent.length, agent, technicalMs)
    const remainingMs = Math.max(0, baseDelay.behavioral_ms - technicalMs)
    await new Promise(r => setTimeout(r, remainingMs))

    // ── 7. DELIVERY via NLD ────────────────────────────────────
    const nldCtx: NLDContext = {
      behaviorProfile,
      engagementProfile,
      safetyProfile,
      relationshipLevel: ctx.conversation.relationship_level,
    }

    try {
      await runNLD(llmResult.text, nldCtx, ctx.user.phone, waSession.sendText.bind(waSession), ctx.wa_jid, event.is_combined ? ctx.wa_message_id : undefined)
    } catch (err) {
      console.error(`[PIPELINE:${tenant.slug}] Delivery falhou:`, err)
      try {
        await waSession.sendText(ctx.user.phone, llmResult.text, ctx.wa_jid)
      } catch {
        // WA ainda desconectado — enfileira para reenvio pós-reconexão
        waSession.queueForRetry(ctx.user.phone, llmResult.text, ctx.wa_jid)
      }
    }

    // ── 7b. LOCATION PIN ───────────────────────────────────────
    if (
      agent.location_enabled &&
      agent.location_lat != null &&
      agent.location_lng != null &&
      isLocationRequest(ctx.textContent)
    ) {
      try {
        await waSession.sendLocation(
          ctx.user.phone,
          agent.location_lat,
          agent.location_lng,
          agent.location_name  ?? undefined,
          agent.location_address ?? undefined,
          ctx.wa_jid
        )
        console.log(`[PIPELINE:${tenant.slug}] Location pin enviado para ${ctx.user.phone}`)
      } catch (err) {
        console.error(`[PIPELINE:${tenant.slug}] Falha ao enviar location pin:`, err)
      }
    }

    // Persiste outbound
    await supabase.from('messages').insert({
      tenant_id:       tenant.id,
      conversation_id: ctx.conversation.id,
      user_id:         ctx.user.id,
      agent_id:        agent.id,
      direction:       'outbound',
      role:            'assistant',
      type:            'text',
      content:         llmResult.text,
      status:          'sent',
      metadata: {
        model:             llmResult.model,
        tokens_prompt:     llmResult.tokens_prompt,
        tokens_completion: llmResult.tokens_completion,
        delay_ms:          baseDelay.behavioral_ms,
      },
    })

    await supabase.from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', ctx.conversation.id)

    // ── 8. NOTIFICAÇÃO async ───────────────────────────────────
    if (agent.notification_enabled && agent.notification_phone) {
      const msgHistory = messages as any
      detectBusinessEvent(msgHistory, llmResult.text)
        .then(result => notifyOwner(agent, ctx.user.phone, (ctx.user as any).display_name, result, waSession, msgHistory))
        .catch(err => console.error(`[PIPELINE:${tenant.slug}] Notificação falhou:`, err))
    }

    // ── 9. MEMORY async ────────────────────────────────────────
    updateMemoryAsync(ctx, agent.id, tenant.id).catch(err => console.error(`[PIPELINE:${tenant.slug}] Memory update falhou:`, err))

    // ── 10. RELATIONSHIP LEVEL async (desativado — habilitar quando validado)
    // evolveRelationshipLevel(ctx, agent.id, tenant.id).catch(err => console.error(`[PIPELINE:${tenant.slug}] Relationship update falhou:`, err))

    const pipelineMs = Date.now() - pipelineStart
    console.log(`[PIPELINE:${tenant.slug}] OK ${pipelineMs}ms | delay=${remainingMs}ms`)

  } catch (err) {
    console.error(`[PIPELINE:${tenant.slug}] Erro fatal:`, err)
  } finally {
    _activePipelines--
    if (conversationId) releaseConversationLock(conversationId)
  }
}

// ─── Behavior padrão ──────────────────────────────────────────
// Pode ser expandido com behavior/engagement engines do SpiceHOT

function buildDefaultBehavior(agent: any, relLevel: number): BehaviorProfile {
  const styleMap: Record<string, Partial<BehaviorProfile>> = {
    casual:    { mood_state: 'calm',        emoji_level: 'light',    flirt_level: 0 },
    formal:    { mood_state: 'calm',        emoji_level: 'none',     flirt_level: 0 },
    playful:   { mood_state: 'playful',     emoji_level: 'moderate', flirt_level: 0.1 },
    intimate:  { mood_state: 'affectionate', emoji_level: 'light',   flirt_level: 0.3 },
  }

  const style = styleMap[agent.response_style ?? 'casual'] ?? styleMap['casual']

  return {
    presence_state:             'available',
    mood_state:                 style.mood_state ?? 'calm',
    relationship:               {
      level: relLevel, label: 'comfortable', proximity: 0.5,
      emotional_openness: 0.5, memory_usage: 0.5, curiosity: 0.4, response_depth: 0.5,
    },
    response_length:            'medium',
    emotional_intensity:        relLevel >= 3 ? 'medium' : 'low',
    curiosity_level:            0.4,
    initiative_level:           0.4,
    flirt_level:                style.flirt_level ?? 0,
    imperfection_level:         0.3,
    emoji_level:                style.emoji_level ?? 'light',
    ask_question:               true,
    audio_probability_modifier: 1,
    delay_modifier:             1,
  }
}

function buildDefaultEngagement(): EngagementProfile {
  return {
    should_recall:      false,
    recall_type:        'no_continuity',
    recall_hint:        null,
    arc_type:           'casual',
    variation_style:    'statement_question',
    forbidden_openings: [],
    last_arc_opening:   null,
    attachment:         { closeness_level: 0.5, warmth: 0.6, emotional_depth: 0.4, restraint: 0.4 },
    emotional_pacing:   'maintain',
    hook_type:          'none',
    hook_hint:          null,
    ask_follow_up:      true,
  }
}

function buildDefaultSafety(): SafetyProfile {
  return {
    allowed:             true,
    risk_level:          'low',
    behavior_override:   null,
    engagement_override: null,
    delay_override_ms:   null,
    audio_allowed:       true,
    max_response_length: null,
    force_neutral_tone:  false,
    should_quarantine:   false,
    should_log_security: false,
    moderation_action:   'allow',
  }
}

// ─── Memory async ─────────────────────────────────────────────

async function updateMemoryAsync(ctx: any, agentId: string, tenantId: string): Promise<void> {
  await extractAndSaveMemories(ctx, agentId, tenantId)
}

// ─── Relationship level ────────────────────────────────────────
//
// Thresholds baseados no total histórico de respostas do agente para o usuário.
// Acumula entre conversas — cliente que voltou mantém o vínculo conquistado.
//
//  0  → novo (< 3 respostas)
//  1  → conhecido (3–9)
//  2  → regular (10–19)
//  3  → familiar (20–49)
//  4  → fidelizado (50–99)
//  5  → VIP (100+)

const REL_THRESHOLDS = [
  { min: 100, level: 5 },
  { min:  50, level: 4 },
  { min:  20, level: 3 },
  { min:  10, level: 2 },
  { min:   3, level: 1 },
  { min:   0, level: 0 },
]

async function evolveRelationshipLevel(ctx: any, agentId: string, tenantId: string): Promise<void> {
  const { user, conversation, agent } = ctx
  const maxLevel = agent.relationship_level_max ?? 5

  // Conta todas as respostas do agente para este usuário (histórico completo)
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id',   user.id)
    .eq('agent_id',  agentId)
    .eq('tenant_id', tenantId)
    .eq('direction', 'outbound')

  const total = count ?? 0
  const newLevel = Math.min(
    REL_THRESHOLDS.find(t => total >= t.min)!.level,
    maxLevel
  )

  if (newLevel !== conversation.relationship_level) {
    await supabase
      .from('conversations')
      .update({ relationship_level: newLevel })
      .eq('id', conversation.id)

    console.log(
      `[PIPELINE:${tenantId}] Vínculo ${conversation.relationship_level}→${newLevel}` +
      ` (user=${user.id.slice(0, 8)}, ${total} respostas)`
    )
  }
}
