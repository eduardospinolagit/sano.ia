/**
 * http/server.ts
 *
 * API HTTP do Sano.ia:
 *
 * Rotas de status:
 *   GET  /health
 *
 * Rotas de gerenciamento de tenant (chamadas pelo dashboard):
 *   GET  /tenants/:id/status          → status geral do tenant
 *   GET  /tenants/:id/wa/status       → status + QR da conexão WA
 *   POST /tenants/:id/wa/connect      → inicia conexão / gera QR
 *   POST /tenants/:id/wa/disconnect   → desconecta
 *   POST /tenants/:id/agent/reload    → recarrega configuração do agente
 *   POST /tenants                     → cria e ativa novo tenant
 */

import http from 'http'
import supabase from '../services/supabase.service'
import {
  bootstrapTenant,
  teardownTenant,
  getRuntime,
  reloadAgent,
} from '../tenant/tenant-manager'
import type { Tenant } from '../types'

const PORT = parseInt(process.env.PORT ?? '3002', 10)

// ─── Helpers ──────────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise(resolve => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
  })
}

function json(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

// ─── Roteador ─────────────────────────────────────────────────

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url    = req.url ?? '/'
  const method = req.method ?? 'GET'

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' })
    res.end()
    return
  }

  // ── GET /health ───────────────────────────────────────────────
  if (method === 'GET' && url === '/health') {
    json(res, 200, { status: 'ok', service: 'sano-ia', ts: new Date().toISOString() })
    return
  }

  // ── GET /tenants/:id/status ───────────────────────────────────
  const tenantStatusMatch = url.match(/^\/tenants\/([^/]+)\/status$/)
  if (method === 'GET' && tenantStatusMatch) {
    const tenantId = tenantStatusMatch[1]
    const runtime  = getRuntime(tenantId)
    if (!runtime) return json(res, 404, { error: 'Tenant não encontrado no runtime' })
    const wa = runtime.waSession.getStatus()
    json(res, 200, {
      tenant:  runtime.tenant.slug,
      agent:   runtime.agent.name,
      wa_status: wa.status,
    })
    return
  }

  // ── GET /tenants/:id/wa/status ────────────────────────────────
  const waStatusMatch = url.match(/^\/tenants\/([^/]+)\/wa\/status$/)
  if (method === 'GET' && waStatusMatch) {
    const tenantId = waStatusMatch[1]
    const runtime  = getRuntime(tenantId)

    // Busca status no banco (mesmo que não esteja no runtime)
    const { data: waSession } = await supabase
      .from('tenant_wa_sessions')
      .select('wa_status, wa_phone, qr_expires_at')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const liveStatus = runtime?.waSession.getStatus()

    json(res, 200, {
      wa_status: liveStatus?.status ?? waSession?.wa_status ?? 'disconnected',
      qr_code:   liveStatus?.qrCode ?? null,
      wa_phone:  waSession?.wa_phone ?? null,
    })
    return
  }

  // ── POST /tenants/:id/wa/connect ──────────────────────────────
  const waConnectMatch = url.match(/^\/tenants\/([^/]+)\/wa\/connect$/)
  if (method === 'POST' && waConnectMatch) {
    const tenantId = waConnectMatch[1]

    const runtime = getRuntime(tenantId)
    if (runtime) {
      const { status } = runtime.waSession.getStatus()
      if (status === 'connected' || status === 'connecting' || status === 'qr_pending') {
        json(res, 200, { message: 'Já inicializado', status })
        return
      }
      // Está no runtime mas desconectado — inicia nova conexão
      runtime.waSession.connect().catch(console.error)
      json(res, 202, { message: 'Reconectando', tenant_id: tenantId })
      return
    }

    // Carrega tenant do banco e faz bootstrap
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (!tenant) return json(res, 404, { error: 'Tenant não encontrado' })

    bootstrapTenant(tenant as Tenant).catch(console.error)
    json(res, 202, { message: 'Bootstrap iniciado', tenant_id: tenantId })
    return
  }

  // ── POST /tenants/:id/wa/disconnect ───────────────────────────
  const waDisconnectMatch = url.match(/^\/tenants\/([^/]+)\/wa\/disconnect$/)
  if (method === 'POST' && waDisconnectMatch) {
    const tenantId = waDisconnectMatch[1]
    await teardownTenant(tenantId)
    await supabase.from('tenant_wa_sessions')
      .update({ wa_status: 'disconnected' })
      .eq('tenant_id', tenantId)
    json(res, 200, { message: 'Desconectado' })
    return
  }

  // ── POST /tenants/:id/agent/reload ────────────────────────────
  const agentReloadMatch = url.match(/^\/tenants\/([^/]+)\/agent\/reload$/)
  if (method === 'POST' && agentReloadMatch) {
    const tenantId = agentReloadMatch[1]
    await reloadAgent(tenantId)
    json(res, 200, { message: 'Agent recarregado' })
    return
  }

  // ── POST /tenants — cria e ativa novo tenant ──────────────────
  if (method === 'POST' && url === '/tenants') {
    const body = await parseBody(req)
    const { name, slug, email, plan_id } = body

    if (!name || !slug || !email) {
      return json(res, 400, { error: 'name, slug e email são obrigatórios' })
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({ name, slug, email, plan_id, status: 'trial' })
      .select('*')
      .single()

    if (error || !tenant) return json(res, 500, { error: error?.message })

    json(res, 201, { tenant })
    return
  }

  json(res, 404, { error: 'Not found' })
}

// ─── Entry point ──────────────────────────────────────────────

export function startHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    try {
      await route(req, res)
    } catch (err) {
      console.error('[HTTP] Erro:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
  })

  server.listen(PORT, () => {
    console.log(`[HTTP] http://localhost:${PORT}`)
    console.log(`[HTTP] /health | /tenants | /tenants/:id/status | /tenants/:id/wa/*`)
  })
}
