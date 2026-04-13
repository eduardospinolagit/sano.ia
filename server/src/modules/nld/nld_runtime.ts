/**
 * nld_runtime.ts
 *
 * Orquestra a camada NLD (Natural Language Delivery):
 *
 *  1. computeNLDStyle   → como escrever
 *  2. computeSplitStrategy → quantas mensagens
 *  3. splitText         → divide o texto original em partes
 *  4. transformText     → transforma cada parte individualmente
 *  5. deliverMessages   → envia com timing humano
 *
 * O split ocorre ANTES do transform para aproveitar a pontuação
 * original como limites naturais de frase.
 */

import { computeNLDStyle }                    from './nld_style.engine'
import { computeSplitStrategy, splitText }    from './nld_split.engine'
import { transformText }                      from './nld_transform.engine'
import { deliverMessages }                    from './nld_delivery.engine'

import type { NLDStyleProfile }               from './nld_style.engine'
import type { SplitStrategy }                 from './nld_split.engine'
import type { SendTextFn }                    from './nld_delivery.engine'
import type { BehaviorProfile, EngagementProfile, SafetyProfile } from '../../types'

// ─── Tipos públicos ───────────────────────────────────────────

export interface NLDContext {
  behaviorProfile:   BehaviorProfile
  engagementProfile: EngagementProfile
  safetyProfile:     SafetyProfile
  relationshipLevel: number
}

export interface NLDResult {
  finalMessages:  string[]
  appliedStyle:   NLDStyleProfile
  splitStrategy:  SplitStrategy
  originalLength: number
  finalLength:    number
}

// ─── Orquestrador ─────────────────────────────────────────────

export async function runNLD(
  text:             string,
  ctx:              NLDContext,
  phone:            string,
  sendText:         SendTextFn,
  waJid?:           string,
  quotedMessageId?: string
): Promise<NLDResult> {
  const { behaviorProfile, engagementProfile, safetyProfile, relationshipLevel } = ctx

  // 1. Perfil de estilo
  const style = computeNLDStyle({
    behavior:           behaviorProfile,
    engagement:         engagementProfile,
    safety:             safetyProfile,
    relationship_level: relationshipLevel,
  })

  // 2. Estratégia de split (usa texto original — pontuação intacta)
  const strategy = computeSplitStrategy(text, style, behaviorProfile)

  // 3. Divide em partes usando o texto original
  const rawParts = splitText(text, strategy)

  // 4. Transforma cada parte individualmente
  const finalMessages = rawParts
    .map(part => transformText(part, style))
    .filter(m => m.length > 0)

  // Garante que ao menos uma mensagem existe
  if (finalMessages.length === 0) {
    finalMessages.push(transformText(text, style) || text)
  }

  // 5. Envia com timing humano
  await deliverMessages(finalMessages, strategy, behaviorProfile, phone, sendText, waJid, quotedMessageId)

  return {
    finalMessages,
    appliedStyle:   style,
    splitStrategy:  strategy,
    originalLength: text.length,
    finalLength:    finalMessages.reduce((acc, m) => acc + m.length, 0),
  }
}
