/**
 * context.module.ts — Multi-tenant com Knowledge Base
 *
 * Monta o contexto para o LLM com 3 camadas:
 *  1. SHORT-TERM  → últimas N mensagens
 *  2. KNOWLEDGE   → base de conhecimento do agente (injetada no system prompt)
 *  3. LONG-TERM   → user_memory (fatos extraídos sobre o usuário)
 */

import supabase from '../../services/supabase.service'
import type { Agent, Conversation, User, UserMemory, KnowledgeEntry } from '../../types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const SHORT_TERM_LIMIT     = parseInt(process.env.SHORT_TERM_LIMIT ?? '15', 10)
const CONFIDENCE_THRESHOLD = parseFloat(process.env.MEMORY_CONFIDENCE_THRESHOLD ?? '0.7')

export interface BuiltContext {
  messages:    ChatCompletionMessageParam[]
  systemPrompt: string
}

export async function buildContext(
  agent:        Agent,
  conversation: Conversation,
  user:         User,
  currentText:  string,
  tenantId:     string
): Promise<BuiltContext> {
  const [shortTerm, knowledge, longTerm] = await Promise.all([
    getShortTerm(conversation.id),
    getKnowledge(tenantId),
    getLongTerm(user.id, agent.id, tenantId),
  ])

  const systemPrompt = buildSystemPrompt(agent, conversation, user, knowledge, longTerm)

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...shortTerm,
    ...(currentText.trim() ? [{ role: 'user' as const, content: currentText }] : []),
  ]

  return { messages, systemPrompt }
}

// ─── Helpers ──────────────────────────────────────────────────

async function getShortTerm(conversationId: string): Promise<ChatCompletionMessageParam[]> {
  const { data } = await supabase
    .from('messages')
    .select('role, content, type')
    .eq('conversation_id', conversationId)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(SHORT_TERM_LIMIT)

  if (!data) return []

  return data.reverse().map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.type === 'audio'    ? `[áudio]: ${m.content}`
           : m.type === 'document' ? (m.content ?? '[documento]')
           : (m.content ?? ''),
  }))
}

async function getKnowledge(tenantId: string): Promise<KnowledgeEntry[]> {
  const { data } = await supabase
    .from('knowledge_entries')
    .select('title, content')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return (data ?? []) as KnowledgeEntry[]
}

async function getLongTerm(userId: string, agentId: string, tenantId: string): Promise<UserMemory[]> {
  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('agent_id', agentId)
    .eq('tenant_id', tenantId)
    .gte('confidence', CONFIDENCE_THRESHOLD)
    .order('confidence', { ascending: false })

  return (data ?? []) as UserMemory[]
}

function buildSystemPrompt(
  agent:        Agent,
  conversation: Conversation,
  user:         User,
  knowledge:    KnowledgeEntry[],
  memories:     UserMemory[]
): string {
  const userName = user.display_name ?? 'ele'
  const level    = conversation.relationship_level

  const knowledgeSection = knowledge.length > 0
    ? `# Base de Conhecimento\n${knowledge.map(k => `## ${k.title}\n${k.content}`).join('\n\n')}`
    : ''

  const memorySection = memories.length > 0
    ? `# O que você sabe sobre ${userName}\n` +
      memories.map(m => `- ${m.memory_key}: ${m.memory_value}`).join('\n')
    : ''

  return `
# Quem você é
${agent.persona_prompt}

${agent.system_rules ? `# Regras\n${agent.system_rules}` : ''}

${knowledgeSection}

# Contexto da conversa
- Nível de vínculo: ${level}/5
- Estado emocional: ${conversation.emotional_state ?? 'neutro'}
- Nome do usuário: ${userName}

${conversation.summary ? `# Resumo anterior\n${conversation.summary}` : ''}

${memorySection}
`.trim()
}
