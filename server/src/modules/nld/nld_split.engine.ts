/**
 * nld_split.engine.ts
 *
 * Decide se e como a resposta é dividida em múltiplas mensagens.
 * O split opera sobre o texto ORIGINAL (antes do transform)
 * para usar as pontuações originais como limites naturais.
 *
 * Depois de dividir, cada parte é transformada individualmente.
 *
 * Prioridade de detecção:
 *  1. Reação no início ("kkkkk", "nossa!", "rsrs") → sempre split
 *  2. Modo working/tired → maioria single
 *  3. Texto longo → split obrigatório
 *  4. Humor/intensidade → distribuição probabilística
 */

import type { NLDStyleProfile } from './nld_style.engine'
import type { BehaviorProfile } from '../../types'

// ─── Tipos ────────────────────────────────────────────────────

export type SplitStrategy =
  | 'single'               // uma mensagem só
  | 'split_2'              // duas mensagens com gap normal
  | 'split_3'              // três mensagens com gap normal
  | 'burst_emotional'      // 2–3 mensagens muito curtas, gaps rápidos
  | 'followup_after_pause' // split_2 mas com pausa longa antes da 2ª mensagem

// ─── Detecção de reação no início do texto ────────────────────
//
// Captura interjections/reações comuns de WhatsApp em PT-BR
// que devem virar uma mensagem separada da resposta principal.

const REACTION_RE = /^((?:(?:rs){2,}|(?:ha){2,}|(?:he){2,}|(?:hue){1,}|(?:hi){2,}|k{3,}|lol)\s*[!?]*\s*|(?:nossa+|eita+|uai|oxe|caramba|meu deus|ai que \S+|que isso|sério\??|mentira!?|jura!?|ufa|opa|oxi|poxa|putz|puts|não acredito|que lindo|que fofo|adorei|amei|perfeito)\s*[!?.,]*\s*)/i

export function startsWithReaction(text: string): boolean {
  return REACTION_RE.test(text.trim())
}

// Extrai a reação do início e o restante do texto
function extractReaction(text: string): { reaction: string; rest: string } | null {
  const match = text.trim().match(REACTION_RE)
  if (!match) return null
  const reaction = match[0].trim()
  const rest     = text.trim().slice(match[0].length).trim()
  if (!rest) return null
  return { reaction, rest }
}

// ─── Decisão de estratégia ────────────────────────────────────

export function computeSplitStrategy(
  text:     string,
  style:    NLDStyleProfile,
  behavior: BehaviorProfile
): SplitStrategy {
  const words    = text.trim().split(/\s+/).length
  const mood     = behavior.mood_state
  const presence = behavior.presence_state
  const intensity = behavior.emotional_intensity

  // ── 1. Reação detectada → sempre split (burst se curto, split_2 se mais longo) ──
  if (startsWithReaction(text)) {
    if (words <= 15) return 'burst_emotional'
    return 'split_2'
  }

  // ── 2. Texto muito curto sem reação → single ──────────────────
  if (words <= 6) return 'single'

  // ── 3. Working / tired → conservador ─────────────────────────
  if (presence === 'working') {
    return Math.random() < 0.80 ? 'single' : 'split_2'
  }
  if (mood === 'tired') {
    return Math.random() < 0.70 ? 'single' : 'split_2'
  }

  // ── 4. Texto longo: split obrigatório ────────────────────────
  if (words > 40) {
    return Math.random() < 0.15 ? 'split_2' : 'split_3'
  }

  // ── 5. Burst emocional: intensity alta + presença emocional ──
  if (
    intensity === 'high'
    && words <= 25
    && (mood === 'affectionate' || presence === 'emotionally_available')
    && Math.random() < 0.35
  ) {
    return 'burst_emotional'
  }

  // ── 6. Playful / flirty → split curto e rápido ───────────────
  if (mood === 'playful' || mood === 'flirty_light') {
    const r = Math.random()
    if (r < 0.10) return 'single'
    if (r < 0.50) return 'split_2'
    if (r < 0.70) return 'split_3'
    if (r < 0.85) return 'followup_after_pause'
    return 'burst_emotional'
  }

  // ── 7. Affectionate / emotionally_available → split frequente ─
  if (mood === 'affectionate' || presence === 'emotionally_available') {
    const r = Math.random()
    if (r < 0.20) return 'single'
    if (r < 0.65) return 'split_2'
    return 'split_3'
  }

  // ── 8. Padrão probabilístico base ────────────────────────────
  const r = Math.random()
  if (r < 0.25) return 'single'
  if (r < 0.75) return 'split_2'
  return 'split_3'
}

// ─── Extrai frases do texto ───────────────────────────────────

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

// ─── Fallback: divide por vírgula ou posição central ─────────

function splitByCommaOrMidpoint(text: string, parts: 2 | 3): string[] {
  const byComma = text
    .split(/,\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (byComma.length >= parts) {
    if (parts === 2) {
      return [byComma[0], byComma.slice(1).join(', ')]
    }
    if (parts === 3) {
      const mid = Math.ceil(byComma.length / 2)
      return [
        byComma.slice(0, 1).join(', '),
        byComma.slice(1, mid).join(', '),
        byComma.slice(mid).join(', '),
      ].filter(s => s.length > 0)
    }
  }

  const words = text.split(' ')
  if (words.length < 4) return [text]

  if (parts === 2) {
    const mid = Math.ceil(words.length / 2)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }

  if (parts === 3) {
    const a = Math.floor(words.length / 3)
    const b = Math.floor((words.length * 2) / 3)
    return [
      words.slice(0, a).join(' '),
      words.slice(a, b).join(' '),
      words.slice(b).join(' '),
    ].filter(s => s.length > 0)
  }

  return [text]
}

// ─── Divide o texto em partes ─────────────────────────────────

export function splitText(text: string, strategy: SplitStrategy): string[] {
  if (strategy === 'single') return [text]

  // ── Reação no início: sempre extrai como 1ª mensagem ─────────
  // (acontece antes de qualquer outra lógica de split)
  const extracted = extractReaction(text)
  if (extracted) {
    const { reaction, rest } = extracted
    if (strategy === 'burst_emotional') {
      // Tenta quebrar o "rest" em mais uma parte se for longo o suficiente
      const restSentences = extractSentences(rest)
      if (restSentences.length >= 2) {
        return [reaction, restSentences[0], restSentences.slice(1).join(' ')]
      }
    }
    return [reaction, rest]
  }

  const sentences = extractSentences(text)

  // ── split_2 / followup_after_pause ──────────────────────────
  if (strategy === 'split_2' || strategy === 'followup_after_pause') {
    if (sentences.length >= 2) {
      const mid = Math.ceil(sentences.length / 2)
      return [
        sentences.slice(0, mid).join(' '),
        sentences.slice(mid).join(' '),
      ]
    }
    const parts = splitByCommaOrMidpoint(text, 2)
    return parts.length >= 2 ? parts : [text]
  }

  // ── split_3 ──────────────────────────────────────────────────
  if (strategy === 'split_3') {
    if (sentences.length >= 3) {
      const a = Math.floor(sentences.length / 3)
      const b = Math.floor((sentences.length * 2) / 3)
      return [
        sentences.slice(0, a || 1).join(' '),
        sentences.slice(a || 1, b).join(' '),
        sentences.slice(b).join(' '),
      ].filter(s => s.length > 0)
    }
    if (sentences.length === 2) {
      return sentences
    }
    const parts = splitByCommaOrMidpoint(text, 3)
    return parts.length >= 2 ? parts : [text]
  }

  // ── burst_emotional ──────────────────────────────────────────
  if (strategy === 'burst_emotional') {
    if (sentences.length >= 3) {
      return sentences.slice(0, 3)
    }
    if (sentences.length === 2) {
      // Sem reação detectada: retorna as 2 frases como estão (não quebra no meio)
      return sentences
    }
    const parts = splitByCommaOrMidpoint(text, 2)
    return parts.length >= 2 ? parts : [text]
  }

  return [text]
}
