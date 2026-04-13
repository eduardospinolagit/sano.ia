/**
 * nld_style.engine.ts
 *
 * Calcula o NLDStyleProfile com base nos perfis de comportamento,
 * engajamento, safety e nível de relacionamento.
 *
 * O estilo define COMO escrever — não O QUÊ escrever.
 */

import type { BehaviorProfile, EngagementProfile, SafetyProfile } from '../../types'

// ─── Tipos exportados ─────────────────────────────────────────

export type CapitalizationStyle = 'normal' | 'mostly_lowercase' | 'fully_lowercase'
export type PunctuationStyle    = 'normal' | 'light' | 'minimal'
export type PolishLevel         = 'high'   | 'medium' | 'low'
export type DrynessLevel        = 'low'    | 'medium' | 'high'
export type SpontaneityLevel    = 'low'    | 'medium' | 'high'
export type EmojiUsage          = 'none'   | 'light'  | 'moderate'

export interface NLDStyleProfile {
  capitalization_style: CapitalizationStyle
  punctuation_style:    PunctuationStyle
  polish_level:         PolishLevel
  dryness:              DrynessLevel
  spontaneity:          SpontaneityLevel
  emoji_usage:          EmojiUsage
}

export interface NLDStyleInput {
  behavior:           BehaviorProfile
  engagement:         EngagementProfile
  safety:             SafetyProfile
  relationship_level: number
}

// ─── Cálculo do perfil ────────────────────────────────────────

export function computeNLDStyle(input: NLDStyleInput): NLDStyleProfile {
  const { behavior, safety, relationship_level } = input
  const mood     = behavior.mood_state
  const presence = behavior.presence_state
  const rel      = relationship_level   // 0–5

  // ─── Capitalization ──────────────────────────────────────────

  let capitalization_style: CapitalizationStyle = 'mostly_lowercase'

  // Working/cansado → mais descuidado com maiúsculas
  if (presence === 'working' || mood === 'tired') {
    capitalization_style = 'fully_lowercase'
  }
  // Relationship alto + humor solto → totalmente lowercase
  if (rel >= 4 && (mood === 'playful' || mood === 'flirty_light' || mood === 'affectionate')) {
    capitalization_style = 'fully_lowercase'
  }
  // Safety: tom neutro forçado → volta ao normal
  if (safety.force_neutral_tone || rel < 2) {
    capitalization_style = 'normal'
  }

  // ─── Punctuation ─────────────────────────────────────────────

  let punctuation_style: PunctuationStyle = 'light'

  if (presence === 'working' || mood === 'tired') {
    punctuation_style = 'minimal'
  }
  if (safety.force_neutral_tone || rel < 2) {
    punctuation_style = 'normal'
  }

  // ─── Polish ──────────────────────────────────────────────────

  let polish_level: PolishLevel = 'low'

  if (rel < 2 || safety.force_neutral_tone) {
    polish_level = 'high'
  } else if (rel < 3 || presence === 'working') {
    polish_level = 'medium'
  }

  // ─── Dryness ─────────────────────────────────────────────────

  let dryness: DrynessLevel = 'low'

  if (mood === 'tired' || presence === 'working' || presence === 'low_availability') {
    dryness = 'high'
  } else if (mood === 'calm' || mood === 'introspective') {
    dryness = 'medium'
  }

  // ─── Spontaneity ─────────────────────────────────────────────

  let spontaneity: SpontaneityLevel = 'medium'

  if (mood === 'playful' || mood === 'flirty_light') {
    spontaneity = 'high'
  } else if (mood === 'tired' || mood === 'introspective' || safety.force_neutral_tone) {
    spontaneity = 'low'
  }

  // ─── Emoji (NLD nunca adiciona — só reflete o que o LLM já colocou) ──

  let emoji_usage: EmojiUsage = 'none'

  if (!safety.force_neutral_tone) {
    if (behavior.emoji_level === 'moderate') emoji_usage = 'moderate'
    else if (behavior.emoji_level === 'light') emoji_usage = 'light'
  }

  return {
    capitalization_style,
    punctuation_style,
    polish_level,
    dryness,
    spontaneity,
    emoji_usage,
  }
}
