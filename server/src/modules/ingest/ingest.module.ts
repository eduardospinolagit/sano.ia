/**
 * ingest.module.ts — Multi-tenant
 *
 * Identifica ou cria usuário (por phone + tenant_id),
 * abre ou retoma conversa ativa, persiste mensagem inbound.
 */

import supabase from '../../services/supabase.service'
import type { InboundEvent, Agent, Tenant, User, Conversation, Message, PipelineContext } from '../../types'

export async function ingest(
  event:  InboundEvent,
  agent:  Agent,
  tenant: Tenant
): Promise<PipelineContext> {
  // 1. Usuário (único por phone + tenant_id)
  const user = await getOrCreateUser(event.phone, tenant.id)

  if (user.is_blocked) throw new Error(`Usuário ${event.phone} bloqueado`)

  // 2. Conversa ativa/pausada
  const conversation = await getOrCreateConversation(user.id, agent.id, tenant.id)

  // 3. Persiste inbound
  const inboundMessage = await persistInbound(event, user.id, agent.id, conversation.id, tenant.id)

  // 4. Toca timestamp
  await supabase.from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)

  return {
    tenant,
    agent,
    user,
    conversation,
    inboundMessage,
    textContent:   event.content ?? '',
    wa_jid:        event.wa_jid,
    wa_message_id: event.wa_message_id,
  }
}

// ─── Helpers ──────────────────────────────────────────────────

async function getOrCreateUser(phone: string, tenantId: string): Promise<User> {
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        tenant_id:     tenantId,
        phone,
        origin:        'whatsapp_inbound',
        is_blocked:    false,
        first_seen_at: now,
        last_seen_at:  now,
      },
      { onConflict: 'tenant_id,phone', ignoreDuplicates: false }
    )
    .select('*')
    .single()

  if (error || !data) throw new Error(`Falha ao criar/atualizar usuário: ${error?.message}`)

  // Atualiza last_seen sem sobrescrever first_seen_at do upsert
  await supabase.from('users').update({ last_seen_at: now }).eq('id', (data as any).id)

  return data as User
}

async function getOrCreateConversation(
  userId:   string,
  agentId:  string,
  tenantId: string
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return existing as Conversation

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      tenant_id:          tenantId,
      user_id:            userId,
      agent_id:           agentId,
      status:             'active',
      relationship_level: 0,
      started_at:         new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error || !created) throw new Error(`Falha ao criar conversa: ${error?.message}`)
  return created as Conversation
}

async function persistInbound(
  event:          InboundEvent,
  userId:         string,
  agentId:        string,
  conversationId: string,
  tenantId:       string
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      tenant_id:       tenantId,
      conversation_id: conversationId,
      user_id:         userId,
      agent_id:        agentId,
      direction:       'inbound',
      role:            'user',
      type:            event.type,
      content:         event.content ?? null,
      media_url:       event.media_url ?? null,
      status:          'received',
      metadata: (event.wa_message_id || event.wa_jid)
        ? { wa_message_id: event.wa_message_id ?? null, wa_jid: event.wa_jid ?? null }
        : null,
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(`Falha ao salvar inbound: ${error?.message}`)
  return data as Message
}
