/**
 * nld_delivery.engine.ts
 *
 * Envia uma lista de mensagens com timing humano entre elas.
 * Gaps aplicados com sleep simples — sem indicador "digitando".
 *
 * Os gaps variam por estratégia e humor da companion.
 */

import type { SplitStrategy } from './nld_split.engine'
import type { BehaviorProfile } from '../../types'

// Tipo da função de envio — injetada pelo caller (WASession.sendText)
export type SendTextFn = (phone: string, text: string, waJid?: string, quotedMessageId?: string) => Promise<void>

// ─── Helpers ─────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Gap entre mensagens ──────────────────────────────────────

function interMessageGap(
  strategy:     SplitStrategy,
  behavior:     BehaviorProfile,
  messageIndex: number   // índice da mensagem que ESTÁ PARA SER enviada
): number {
  const mood     = behavior.mood_state
  const presence = behavior.presence_state

  switch (strategy) {
    case 'burst_emotional':
      // Rápido — imita "digitação frenética"
      return rand(800, 3_000)

    case 'followup_after_pause':
      // Primeira pausa é longa (como se tivesse pensado depois de enviar)
      // gaps seguintes são normais
      if (messageIndex === 1) return rand(7_000, 16_000)
      return rand(2_000, 5_000)

    case 'split_3': {
      if (mood === 'playful' || mood === 'flirty_light') return rand(1_200, 3_800)
      if (presence === 'emotionally_available')          return rand(3_000, 8_000)
      if (mood === 'tired')                              return rand(3_500, 7_000)
      return rand(2_000, 6_000)
    }

    case 'split_2':
    default: {
      if (mood === 'playful' || mood === 'flirty_light') return rand(1_500, 4_500)
      if (presence === 'working')                        return rand(1_800, 3_500)
      if (mood === 'tired')                              return rand(3_000, 7_000)
      if (presence === 'emotionally_available')          return rand(3_000, 9_000)
      return rand(2_500, 7_000)
    }
  }
}

// ─── Entry point ─────────────────────────────────────────────

/**
 * Envia múltiplas mensagens com gap + indicador "digitando" entre elas.
 * A primeira mensagem é enviada imediatamente (o delay principal já ocorreu).
 */
export async function deliverMessages(
  messages:         string[],
  strategy:         SplitStrategy,
  behavior:         BehaviorProfile,
  phone:            string,
  sendText:         SendTextFn,
  waJid?:           string,
  quotedMessageId?: string   // ID Baileys para reply na 1ª mensagem
): Promise<void> {
  let sentCount = 0
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i].trim()
    if (!msg) continue

    if (sentCount > 0) {
      // Aguarda gap entre mensagens sem enviar indicador "digitando"
      await sleep(interMessageGap(strategy, behavior, sentCount))
    }

    // Apenas a primeira mensagem usa reply/quote
    const quoteId = sentCount === 0 ? quotedMessageId : undefined
    await sendText(phone, msg, waJid, quoteId)
    sentCount++
  }
}
