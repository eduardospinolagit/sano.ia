/**
 * guardrails.engine.ts — Proteções antes do pipeline
 */

import supabase from '../../services/supabase.service'
import type { GuardrailsResult } from '../../types'

// ─── Lock de conversa (em memória) ───────────────────────────

const LOCK_TTL_MS    = 120_000
const _locks = new Map<string, number>()

export function acquireConversationLock(conversationId: string): boolean {
  const existing = _locks.get(conversationId)
  if (existing) {
    if (Date.now() - existing > LOCK_TTL_MS) {
      _locks.delete(conversationId)
    } else {
      return false
    }
  }
  _locks.set(conversationId, Date.now())
  return true
}

export function releaseConversationLock(conversationId: string): void {
  _locks.delete(conversationId)
}

// ─── Guardrails ───────────────────────────────────────────────

export async function runGuardrails(input: {
  userId:      string
  tenantId:    string
  waMessageId?: string
}): Promise<GuardrailsResult> {
  const { userId, tenantId, waMessageId } = input

  // Usuário bloqueado
  if (userId !== 'unknown') {
    const { data } = await supabase
      .from('users')
      .select('is_blocked')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (data?.is_blocked) {
      return { verdict: 'block', reason: 'Usuário bloqueado' }
    }
  }

  // Mensagem duplicada
  if (waMessageId) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .contains('metadata', { wa_message_id: waMessageId })

    if ((count ?? 0) > 0) {
      return { verdict: 'block', reason: 'Mensagem duplicada' }
    }
  }

  return { verdict: 'allow', reason: null }
}

// ─── Resposta vazia ───────────────────────────────────────────

export function guardEmptyResponse(text: string | null | undefined): GuardrailsResult {
  if (!text || text.trim().length === 0) {
    return { verdict: 'recover', reason: 'Resposta vazia' }
  }
  return { verdict: 'allow', reason: null }
}
