/**
 * delivery.module.ts
 * Envia a resposta via NLD (fragmentação humana) ou texto direto.
 * Persiste a mensagem outbound no banco.
 */

import supabase from '../../services/supabase.service'
import { runNLD } from '../nld/nld_runtime'
import type { PipelineContext, LLMResponse, DelayResult } from '../../types'
import type { NLDContext } from '../nld/nld_runtime'
import type { SendTextFn } from '../nld/nld_delivery.engine'

export async function deliver(
  ctx:       PipelineContext,
  llm:       LLMResponse,
  delay:     DelayResult,
  sendText:  SendTextFn,
  nldCtx?:   NLDContext
): Promise<void> {
  const { user, agent, conversation, tenant } = ctx

  if (nldCtx) {
    await runNLD(llm.text, nldCtx, user.phone, sendText, ctx.wa_jid, ctx.wa_message_id)
  } else {
    await sendText(user.phone, llm.text, ctx.wa_jid)
  }

  // Persiste outbound
  await supabase.from('messages').insert({
    tenant_id:       tenant.id,
    conversation_id: conversation.id,
    user_id:         user.id,
    agent_id:        agent.id,
    direction:       'outbound',
    role:            'assistant',
    type:            'text',
    content:         llm.text,
    status:          'sent',
    metadata: {
      model:             llm.model,
      tokens_prompt:     llm.tokens_prompt,
      tokens_completion: llm.tokens_completion,
      delay_ms:          delay.behavioral_ms,
    },
  })

  await supabase.from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversation.id)
}
