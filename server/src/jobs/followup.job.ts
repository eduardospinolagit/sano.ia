/**
 * followup.job.ts
 *
 * Roda a cada 30 minutos e envia mensagens de follow-up
 * para conversas que o agente enviou a última mensagem mas
 * o usuário não respondeu dentro do prazo configurado.
 *
 * Lógica:
 *  1. Busca conversas ativas com last_message_at antigo o suficiente
 *  2. Confirma que a última mensagem é outbound (agente esperando resposta)
 *  3. Conta follow-ups já enviados nessa conversa
 *  4. Se abaixo do limite, envia a próxima mensagem da sequência
 */

import supabase          from '../services/supabase.service'
import { getAllRuntimes } from '../tenant/tenant-manager'

const INTERVAL_MS = 30 * 60 * 1000   // verifica a cada 30 min

export function startFollowupJob(): void {
  setInterval(runFollowup, INTERVAL_MS)
  console.log('[FOLLOWUP] Iniciado — verificação a cada 30min')
}

async function runFollowup(): Promise<void> {
  const runtimes = getAllRuntimes()
  for (const runtime of runtimes) {
    if (!runtime.waSession.isConnected()) continue
    if (!runtime.agent.followup_enabled)   continue
    try {
      await checkTenant(runtime)
    } catch (err) {
      console.error(`[FOLLOWUP:${runtime.tenant.slug}] Erro:`, err)
    }
  }
}

async function checkTenant(runtime: any): Promise<void> {
  const { tenant, agent, waSession } = runtime

  const delayMs   = (agent.followup_delay_hours ?? 24) * 60 * 60 * 1000
  const maxAttempts: number  = agent.followup_max_attempts ?? 3
  const messages: string[]   = agent.followup_messages ?? []

  if (messages.length === 0) return

  const cutoff = new Date(Date.now() - delayMs).toISOString()

  // 1. Conversas ativas com last_message_at antigo o suficiente
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, user_id, last_message_at')
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .lte('last_message_at', cutoff)

  if (!conversations || conversations.length === 0) return

  for (const conv of conversations) {
    try {
      await processConversation(conv, tenant, agent, waSession, messages, maxAttempts)
    } catch (err) {
      console.error(`[FOLLOWUP:${tenant.slug}] Falha conv=${conv.id.slice(0, 8)}:`, err)
    }
  }
}

async function processConversation(
  conv:        any,
  tenant:      any,
  agent:       any,
  waSession:   any,
  messages:    string[],
  maxAttempts: number
): Promise<void> {
  // 2. Confirma que a última mensagem é outbound
  const { data: lastMsg } = await supabase
    .from('messages')
    .select('id, direction, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastMsg || lastMsg.direction !== 'outbound') return

  // 3. Conta follow-ups já enviados
  const { count: followupCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conv.id)
    .eq('direction', 'outbound')
    .contains('metadata', { is_followup: true })

  const attempts = followupCount ?? 0
  if (attempts >= maxAttempts) return

  // 4. Escolhe a mensagem da sequência (usa a última se não tiver suficientes)
  const idx  = Math.min(attempts, messages.length - 1)
  const text = messages[idx]?.trim()
  if (!text) return

  // 5. Busca o phone do usuário
  const { data: user } = await supabase
    .from('users')
    .select('phone')
    .eq('id', conv.user_id)
    .single()

  if (!user?.phone) return

  // Recupera wa_jid da última mensagem inbound — evita enviar para LID inválido
  const { data: lastInbound } = await supabase
    .from('messages')
    .select('metadata')
    .eq('conversation_id', conv.id)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const waJid: string | undefined = lastInbound?.metadata?.wa_jid ?? undefined

  console.log(`[FOLLOWUP:${tenant.slug}] Enviando tentativa ${attempts + 1}/${maxAttempts} → ${user.phone}${waJid ? ` (jid=${waJid})` : ''}`)

  // 6. Envia via WA usando o JID real (não o phone que pode ser LID)
  await waSession.sendText(user.phone, text, waJid)

  // 7. Persiste outbound com flag is_followup
  await supabase.from('messages').insert({
    tenant_id:       tenant.id,
    conversation_id: conv.id,
    user_id:         conv.user_id,
    agent_id:        agent.id,
    direction:       'outbound',
    role:            'assistant',
    type:            'text',
    content:         text,
    status:          'sent',
    metadata:        { is_followup: true, followup_attempt: attempts + 1 },
  })

  // 8. Atualiza last_message_at
  await supabase.from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conv.id)
}
