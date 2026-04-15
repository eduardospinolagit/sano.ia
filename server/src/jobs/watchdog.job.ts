/**
 * watchdog.job.ts
 *
 * Verifica a cada 3 minutos se alguma mensagem recebida
 * ficou sem resposta (pipeline travou ou crashou).
 * Se encontrar, re-executa o pipeline para aquela mensagem.
 */

import supabase          from '../services/supabase.service'
import { getAllRuntimes } from '../tenant/tenant-manager'
import { runPipeline }   from '../pipeline/pipeline'
import type { InboundEvent } from '../types'

const INTERVAL_MS = 3 * 60 * 1000   // verifica a cada 3 min
const MIN_AGE_MS  = 2 * 60 * 1000   // mensagem deve ter ao menos 2 min (evita corrida com pipeline normal)
const MAX_AGE_MS  = 30 * 60 * 1000  // ignora mensagens com mais de 30 min (muito antigas)

export function startWatchdog(): void {
  // Usa apenas setInterval — começa após INTERVAL_MS (tempo para o boot estabilizar)
  // Não combinar com setTimeout ou a primeira execução ficaria duplicada
  setInterval(runWatchdog, INTERVAL_MS)
  console.log('[WATCHDOG] Iniciado — verificação a cada 3min')
}

async function runWatchdog(): Promise<void> {
  const runtimes = getAllRuntimes()
  for (const runtime of runtimes) {
    if (!runtime.waSession.isConnected()) continue
    try {
      await checkTenant(runtime)
    } catch (err) {
      console.error(`[WATCHDOG:${runtime.tenant.slug}] Erro:`, err)
    }
  }
}

async function checkTenant(runtime: any): Promise<void> {
  const { tenant } = runtime
  const now    = Date.now()
  const minAgo = new Date(now - MIN_AGE_MS).toISOString()
  const maxAgo = new Date(now - MAX_AGE_MS).toISOString()

  // Busca mensagens inbound recebidas dentro da janela de tempo
  const { data: candidates } = await supabase
    .from('messages')
    .select('id, conversation_id, content, type, metadata, created_at, user_id')
    .eq('tenant_id', tenant.id)
    .eq('direction', 'inbound')
    .gte('created_at', maxAgo)
    .lte('created_at', minAgo)
    .order('created_at', { ascending: false })

  if (!candidates || candidates.length === 0) return

  // Deduplica: pega apenas a mensagem mais recente por conversa
  const latestByConv = new Map<string, any>()
  for (const msg of candidates) {
    if (!latestByConv.has(msg.conversation_id)) {
      latestByConv.set(msg.conversation_id, msg)
    }
  }

  for (const msg of latestByConv.values()) {
    // Verifica se já foi respondida
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', msg.conversation_id)
      .eq('direction', 'outbound')
      .gt('created_at', msg.created_at)

    if ((count ?? 0) > 0) continue  // já respondida

    // Verifica se a conversa está pausada (atendimento humano)
    const { data: conv } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', msg.conversation_id)
      .maybeSingle()

    if (conv?.status === 'paused') continue

    // Busca o telefone do usuário
    const { data: user } = await supabase
      .from('users')
      .select('phone, display_name')
      .eq('id', msg.user_id)
      .single()

    if (!user?.phone) continue

    console.log(`[WATCHDOG:${tenant.slug}] Sem resposta detectada — conv=${msg.conversation_id.slice(0,8)} user=${user.phone} msg=${msg.id.slice(0,8)}`)

    const event: InboundEvent = {
      tenant_id:     tenant.id,
      phone:         user.phone,
      type:          msg.type ?? 'text',
      content:       msg.content ?? '',
      wa_jid:        msg.metadata?.wa_jid  ?? undefined,
      wa_message_id: msg.metadata?.wa_message_id ?? undefined,
    }

    // Executa o pipeline sem await para não travar o loop
    runPipeline(event, runtime).catch(err =>
      console.error(`[WATCHDOG:${tenant.slug}] Falha no retry conv=${msg.conversation_id.slice(0,8)}:`, err)
    )
  }
}
