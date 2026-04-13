/**
 * delay.module.ts
 *
 * Simula comportamento humano separando:
 *   - delay técnico   → tempo real de processamento (não controlamos)
 *   - delay comportamental → atraso simulado intencional antes de enviar
 *
 * Delay comportamental padrão:
 *   horário ativo → 30s – 240s (4 min), aleatório uniforme
 *   horário ocupado → +30s – 60s extra sobre o base
 *   jitter mínimo (±5%) — range já é amplo o suficiente
 *
 * Indicador "digitando" desativado — não é enviado ao contato.
 */

import type { Agent, DelayProfile, ActiveHoursConfig, DelayResult } from '../../types'

// ─── Delay profile padrão (quando companion não tem configurado) ──

const DEFAULT_PROFILE: DelayProfile = {
  text_short_min_s:  30,
  text_short_max_s:  240,
  text_long_min_s:   30,
  text_long_max_s:   240,
  audio_min_s:       60,
  audio_max_s:       240,
  busy_extra_min_s:  30,
  busy_extra_max_s:  60,
  jitter_pct:        0.05,
}

// ─── Helpers ──────────────────────────────────────────────────

function rand(min: number, max: number): number {
  const a = isFinite(min) ? min : 15
  const b = isFinite(max) ? max : 50
  return a + Math.random() * (b - a)
}

function applyJitter(value: number, jitter_pct: number): number {
  const delta = value * jitter_pct
  return value + rand(-delta, delta)
}

// ─── Verifica se horário atual está no active_hours ───────────

function isActiveHour(config: ActiveHoursConfig | null): boolean {
  if (!config) return true   // sem config = sempre ativo

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const today = days[new Date().getDay()]
  const now   = new Date()
  const hhmm  = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Tenta o dia atual; se não tiver, itera todos os dias configurados
  const dayCfg = config[today] ?? {}
  for (const slot of Object.values(dayCfg)) {
    if (!slot || !slot.available) continue
    if (timeInSlot(hhmm, slot.start, slot.end)) return true
  }

  return false   // fora de qualquer faixa ativa
}

function timeInSlot(current: string, start: string, end: string): boolean {
  // Suporta slots que cruzam meia-noite (ex: 23:30 → 07:00)
  if (start <= end) {
    return current >= start && current <= end
  } else {
    return current >= start || current <= end
  }
}

// ─── Cálculo do delay comportamental ─────────────────────────

export function calculateDelay(
  type:        'text' | 'audio' | 'image',
  contentLen:  number,
  agent:       Agent | { delay_profile?: any; active_hours_config?: any },
  technicalMs: number
): DelayResult {
  const profile: DelayProfile = { ...DEFAULT_PROFILE, ...(agent.delay_profile ?? {}) }

  let baseSeconds: number

  if (type === 'audio') {
    baseSeconds = rand(profile.audio_min_s, profile.audio_max_s)
  } else {
    const isShort = contentLen < 100
    baseSeconds = isShort
      ? rand(profile.text_short_min_s, profile.text_short_max_s)
      : rand(profile.text_long_min_s,  profile.text_long_max_s)
  }

  // Adiciona extra se fora do horário ativo
  const active = isActiveHour(agent.active_hours_config ?? null)
  if (!active) {
    baseSeconds += rand(profile.busy_extra_min_s, profile.busy_extra_max_s)
  }

  // Aplica jitter
  const withJitter = applyJitter(baseSeconds, profile.jitter_pct)

  // Garante mínimo absoluto de 5 segundos
  const behavioral_ms = Math.max(5_000, Math.round(withJitter * 1_000))

  // Desconta o tempo técnico já gasto (evita delay acumulado)
  const remaining_ms  = Math.max(0, behavioral_ms - technicalMs)

  return {
    technical_ms:  technicalMs,
    behavioral_ms,
    total_ms:      technicalMs + remaining_ms,
  }
}

// ─── Executa o delay (aguarda) ────────────────────────────────

export async function applyDelay(delayResult: DelayResult): Promise<void> {
  const remaining = Math.max(0, delayResult.behavioral_ms - delayResult.technical_ms)
  if (remaining > 0) {
    await sleep(remaining)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
