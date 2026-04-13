/**
 * llm.module.ts — Geração de resposta via OpenAI
 */

import openai from '../../services/openai.service'
import type { Agent, LLMResponse } from '../../types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const DEFAULT_MODEL       = 'gpt-4o-mini'
const DEFAULT_TEMPERATURE = 0.85
const MAX_TOKENS          = 500

export async function generateResponse(
  messages:  ChatCompletionMessageParam[],
  agent:     Agent | { model_name?: string; temperature?: number; name?: string },
  meta?:     { user_id?: string; conversation_id?: string; message_id?: string }
): Promise<LLMResponse> {
  const model       = (agent as any).model_name ?? DEFAULT_MODEL
  const temperature = (agent as any).temperature ?? DEFAULT_TEMPERATURE
  const start       = Date.now()

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens:  MAX_TOKENS,
  })

  const text    = completion.choices[0]?.message?.content ?? ''
  const latency = Date.now() - start

  return {
    text,
    model,
    tokens_prompt:     completion.usage?.prompt_tokens     ?? 0,
    tokens_completion: completion.usage?.completion_tokens ?? 0,
    latency_ms:        latency,
  }
}
