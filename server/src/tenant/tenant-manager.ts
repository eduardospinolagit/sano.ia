/**
 * tenant-manager.ts
 *
 * Gerencia o ciclo de vida de todos os tenants ativos:
 *  - Carrega tenants do banco no boot
 *  - Inicializa WASession por tenant
 *  - Mantém TenantRuntime em memória
 *  - Permite adicionar/remover tenants em runtime
 */

import path    from 'path'
import fs      from 'fs'
import supabase from '../services/supabase.service'
import { WASession } from '../services/wa-session'
import { runPipeline } from '../pipeline/pipeline'
import type { Tenant, Agent, InboundEvent } from '../types'

// ─── Runtime por tenant ───────────────────────────────────────

export interface TenantRuntime {
  tenant:      Tenant
  agent:       Agent
  waSession:   WASession
  debounce:    Map<string, { events: InboundEvent[]; timer: ReturnType<typeof setTimeout> }>
  currentArcs: Map<string, string>   // conversationId → arc_type
}

const _runtimes = new Map<string, TenantRuntime>()

const AUTH_BASE = path.resolve(process.cwd(), 'auth_info')
const DEBOUNCE_MS = 2_000

// ─── Acesso ao runtime ────────────────────────────────────────

export function getRuntime(tenantId: string): TenantRuntime | undefined {
  return _runtimes.get(tenantId)
}

export function getAllRuntimes(): TenantRuntime[] {
  return [..._runtimes.values()]
}

// ─── Bootstrap de um tenant ───────────────────────────────────

export async function bootstrapTenant(tenant: Tenant): Promise<void> {
  if (_runtimes.has(tenant.id)) {
    console.log(`[TENANT] ${tenant.slug} já inicializado, ignorando`)
    return
  }

  console.log(`[TENANT] Inicializando ${tenant.slug}...`)

  // 1. Carrega agent ativo
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error || !agent) {
    console.error(`[TENANT] ${tenant.slug}: nenhum agent ativo — pulando`)
    return
  }

  // 2. Cria/carrega registro de sessão WA
  const authDir = path.join(AUTH_BASE, `tenant_${tenant.id}`)
  await supabase
    .from('tenant_wa_sessions')
    .upsert({
      tenant_id: tenant.id,
      auth_dir:  authDir,
      wa_status: 'disconnected',
    }, { onConflict: 'tenant_id' })

  // 3. Cria WASession
  const waSession = new WASession(tenant.id, authDir)

  // 4. Runtime em memória
  const runtime: TenantRuntime = {
    tenant,
    agent:       agent as Agent,
    waSession,
    debounce:    new Map(),
    currentArcs: new Map(),
  }
  _runtimes.set(tenant.id, runtime)

  // 5. Handler de mensagens com debounce
  waSession.onMessage(async (event: InboundEvent) => {
    console.log(`[PIPELINE:${tenant.slug}] ${event.phone} → ${event.type}`)
    scheduleMessage(runtime, event)
  })

  // 6. Atualiza status WA no banco quando conecta/desconecta
  waSession.onConnected(async () => {
    await supabase
      .from('tenant_wa_sessions')
      .update({ wa_status: 'connected', last_connected_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
  })

  waSession.onQR(async (_qr: string) => {
    await supabase
      .from('tenant_wa_sessions')
      .update({ wa_status: 'qr_pending', qr_expires_at: new Date(Date.now() + 60_000).toISOString() })
      .eq('tenant_id', tenant.id)
  })

  // 7. Auto-conecta apenas se houver credenciais salvas (restaura sessão anterior)
  const credsFile = path.join(authDir, 'creds.json')
  if (fs.existsSync(credsFile)) {
    console.log(`[TENANT] ${tenant.slug} — credenciais encontradas, restaurando sessão...`)
    waSession.connect().catch(e => console.error(`[TENANT] ${tenant.slug}: falha ao restaurar sessão:`, e))
  } else {
    console.log(`[TENANT] ${tenant.slug} — sem credenciais, aguardando conexão manual`)
  }

  console.log(`[TENANT] ${tenant.slug} inicializado — agent: ${agent.name}`)
}

// ─── Remove tenant do runtime ─────────────────────────────────

export async function teardownTenant(tenantId: string): Promise<void> {
  const runtime = _runtimes.get(tenantId)
  if (!runtime) return

  runtime.waSession.disconnect()
  _runtimes.delete(tenantId)
  console.log(`[TENANT] ${runtime.tenant.slug} removido do runtime`)
}

// ─── Recarrega agent (quando cliente salva configuração) ──────

export async function reloadAgent(tenantId: string): Promise<void> {
  const runtime = _runtimes.get(tenantId)
  if (!runtime) return

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (agent) {
    runtime.agent = agent as Agent
    console.log(`[TENANT] ${runtime.tenant.slug}: agent recarregado`)
  }
}

// ─── Debounce de mensagens ────────────────────────────────────

function scheduleMessage(runtime: TenantRuntime, event: InboundEvent): void {
  const key      = event.phone
  const existing = runtime.debounce.get(key)

  if (existing) {
    clearTimeout(existing.timer)
    existing.events.push(event)
  } else {
    runtime.debounce.set(key, { events: [event], timer: null! })
  }

  const buf  = runtime.debounce.get(key)!
  buf.timer  = setTimeout(async () => {
    runtime.debounce.delete(key)
    await flushDebounce(runtime, buf.events)
  }, DEBOUNCE_MS)
}

async function flushDebounce(runtime: TenantRuntime, events: InboundEvent[]): Promise<void> {
  if (events.length === 1) {
    await runPipeline(events[0], runtime)
    return
  }

  const hasNonText = events.some(e => e.type !== 'text')

  if (hasNonText) {
    // Áudios/imagens não podem ser fundidos — processa cada um em sequência
    console.log(`[PIPELINE:${runtime.tenant.slug}] Debounce: ${events.length} eventos (áudio/misto) de ${events[0].phone} — processando em sequência`)
    for (const event of events) {
      await runPipeline({ ...event, is_combined: events.length > 1 }, runtime)
    }
    return
  }

  // Todos são texto — combina em um único pipeline
  const textParts = events
    .filter(e => e.content?.trim())
    .map(e => e.content!)

  const last = events[events.length - 1]
  const combined: InboundEvent = { ...last, type: 'text', content: textParts.join('\n'), is_combined: true }

  console.log(`[PIPELINE:${runtime.tenant.slug}] Debounce: ${events.length} msgs de ${last.phone}`)
  await runPipeline(combined, runtime)
}

// ─── Boot: carrega todos os tenants ativos ────────────────────

export async function initAllTenants(): Promise<void> {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('*')
    .in('status', ['active', 'trial'])

  if (error) throw new Error(`Falha ao carregar tenants: ${error.message}`)
  if (!tenants || tenants.length === 0) {
    console.log('[TENANT] Nenhum tenant ativo encontrado')
    return
  }

  console.log(`[TENANT] Inicializando ${tenants.length} tenant(s)...`)
  for (const tenant of tenants) {
    await bootstrapTenant(tenant as Tenant)
  }
  console.log('[TENANT] Todos os tenants inicializados')
}
