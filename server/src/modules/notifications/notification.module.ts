/**
 * notification.module.ts
 *
 * Detecta eventos de negócio e extrai campos específicos via LLM.
 * A notificação enviada ao empresário inclui apenas os campos
 * que ele selecionou no painel.
 */

import openai    from '../../services/openai.service'
import type { Agent } from '../../types'

export type BusinessEvent =
  | 'venda'
  | 'pedido_delivery'
  | 'reuniao'
  | 'lead_qualificado'
  | 'nenhum'

export interface DetectionResult {
  event:     BusinessEvent
  resumo:    string
  valor?:    string | null
  horario?:  string | null
  produtos?: string[] | null
  pagamento?: string | null
  endereco?: string | null
  contexto?: string | null
}

const EVENT_LABELS: Record<BusinessEvent, string> = {
  venda:             '💰 Venda realizada',
  pedido_delivery:   '🛵 Pedido de delivery',
  reuniao:           '📅 Reunião marcada',
  lead_qualificado:  '🎯 Lead qualificado',
  nenhum:            '',
}

// ─── Campos disponíveis ───────────────────────────────────────

export const NOTIFICATION_FIELD_LABELS: Record<string, string> = {
  cliente:   'Cliente (nome e telefone)',
  resumo:    'Resumo do evento',
  valor:     'Valor da compra / pedido',
  produtos:  'Produtos / itens',
  pagamento: 'Forma de pagamento',
  horario:   'Horário / data',
  endereco:  'Endereço de entrega',
  contexto:  'Contexto da conversa',
}

// ─── Detecção ─────────────────────────────────────────────────

export async function detectBusinessEvent(
  recentMessages: { role: string; content: string }[],
  agentResponse:  string
): Promise<DetectionResult> {
  const context = recentMessages
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
    .join('\n')

  const prompt = `Analise a conversa e extraia informações de negócio. Responda SOMENTE com JSON válido, sem markdown.

Conversa:
${context}
Agente: ${agentResponse}

JSON esperado:
{
  "event": "venda|pedido_delivery|reuniao|lead_qualificado|nenhum",
  "resumo": "descrição em 1 linha (vazio se nenhum evento)",
  "valor": "valor monetário mencionado ou null",
  "horario": "horário ou data mencionados ou null",
  "produtos": ["item 1", "item 2"] ou null,
  "pagamento": "forma de pagamento ou null",
  "endereco": "endereço de entrega ou null",
  "contexto": "contexto relevante em 1 linha ou null"
}

Definições de evento:
- venda: cliente confirmou compra ou pagamento
- pedido_delivery: cliente fez pedido para entrega
- reuniao: agendamento confirmado
- lead_qualificado: interesse real com intenção clara
- nenhum: sem evento relevante`

  try {
    const res = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0,
      max_tokens:  250,
      messages:    [{ role: 'user', content: prompt }],
    })

    const raw  = res.choices[0]?.message?.content?.trim() ?? ''
    const json = JSON.parse(raw) as DetectionResult
    return json
  } catch {
    return { event: 'nenhum', resumo: '' }
  }
}

// ─── Formatação por campos selecionados ───────────────────────

function formatMessage(
  agent:       Agent,
  clienteStr:  string,
  result:      DetectionResult
): string {
  const fields  = agent.notification_fields ?? ['cliente', 'resumo']
  const label   = EVENT_LABELS[result.event]
  const lines: string[] = [
    `🔔 *${agent.name}*  •  ${label}`,
    `━━━━━━━━━━━━━━━━━`,
  ]

  if (fields.includes('cliente'))
    lines.push(`👤 *Cliente:* ${clienteStr}`)

  if (fields.includes('resumo') && result.resumo)
    lines.push(`📝 *Resumo:* ${result.resumo}`)

  if (fields.includes('valor') && result.valor)
    lines.push(`💵 *Valor:* ${result.valor}`)

  if (fields.includes('produtos') && result.produtos?.length) {
    lines.push(`🛍️ *Produtos:*`)
    result.produtos.forEach(p => lines.push(`  • ${p}`))
  }

  if (fields.includes('pagamento') && result.pagamento)
    lines.push(`💳 *Pagamento:* ${result.pagamento}`)

  if (fields.includes('horario') && result.horario)
    lines.push(`🕐 *Horário:* ${result.horario}`)

  if (fields.includes('endereco') && result.endereco)
    lines.push(`📍 *Endereço:* ${result.endereco}`)

  if (fields.includes('contexto') && result.contexto)
    lines.push(`💬 *Contexto:* ${result.contexto}`)

  return lines.join('\n')
}

// ─── Notificação ──────────────────────────────────────────────

export async function notifyOwner(
  agent:          Agent,
  clientPhone:    string,
  clientName:     string | undefined,
  result:         DetectionResult,
  waSession:      any,
  recentMessages: { role: string; content: string }[] = []
): Promise<void> {
  if (!agent.notification_enabled) return
  if (!agent.notification_phone)   return
  if (result.event === 'nenhum')   return

  const clienteStr = clientName ? `${clientName} (${clientPhone})` : clientPhone
  const mensagem   = formatMessage(agent, clienteStr, result)

  try {
    const { exists, jid } = await waSession.resolvePhone(agent.notification_phone)
    if (!exists) {
      console.warn(`[NOTIFY] Número ${agent.notification_phone} não encontrado no WhatsApp`)
      return
    }
    await waSession.sendText(agent.notification_phone, mensagem, jid)
    const fields = (agent.notification_fields ?? []).join(',')
    console.log(`[NOTIFY] Evento "${result.event}" campos=[${fields}] → ${jid}`)
  } catch (err) {
    console.error('[NOTIFY] Falha ao enviar notificação:', err)
  }
}
