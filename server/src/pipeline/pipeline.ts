/**
 * pipeline.ts — Orquestrador multi-tenant do Sano.ia
 *
 * Fluxo por mensagem:
 *  0.  guardrails  → lock, dedup, usuário bloqueado
 *  1.  ingest      → user, conversa, persist inbound
 *  2.  transcription (se áudio)
 *  3.  context     → short-term + knowledge base + memory
 *  4.  behavior    → presence/mood/relationship
 *  5.  llm         → GPT com retry + fallback
 *  6.  delay       → comportamental
 *  7.  delivery    → NLD + envio WA com reply
 *  8.  memory      → extrai fatos async
 */

import * as fs   from 'fs'
import * as path from 'path'
import * as os   from 'os'

import supabase from '../services/supabase.service'
import openai   from '../services/openai.service'

import { logger }           from '../modules/logger/logger.module'
import { ingest }           from '../modules/ingest/ingest.module'
import { buildContext }     from '../modules/context/context.module'
import { generateResponse } from '../modules/llm/llm.module'
import { calculateDelay }   from '../modules/delay/delay.module'
import { deliver }          from '../modules/delivery/delivery.module'
import { runNLD }           from '../modules/nld/nld_runtime'
import {
  waitForConversationLock,
  releaseConversationLock,
  runGuardrails,
  guardEmptyResponse,
} from '../modules/ops/guardrails.engine'
import { detectBusinessEvent, notifyOwner } from '../modules/notifications/notification.module'

import type { InboundEvent, BehaviorProfile, EngagementProfile, SafetyProfile } from '../types'
import type { TenantRuntime } from '../tenant/tenant-manager'
import type { NLDContext }    from '../modules/nld/nld_runtime'

// ─── Detecção de pedido de localização ───────────────────────

const LOCATION_KEYWORDS = [
  'localização', 'localizacao', 'endereço', 'endereco', 'onde fica',
  'onde vocês ficam', 'onde voces ficam', 'como chegar', 'mapa',
  'pin', 'maps', 'google maps', 'sua localização', 'sua localizacao',
  'loja fica', 'loja está', 'loja esta', 'fica onde', 'onde estão',
]

function isLocationRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return LOCATION_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── Sleep (23:00–08:00) ──────────────────────────────────────

function isSleepTime(agent: { active_hours_config?: any }): boolean {
  const config = agent.active_hours_config

  // Se configurado como 24h ou sem configuração de horário, sempre ativo
  if (!config || config.always_on === true || config.enabled === false) return false

  const now    = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const h      = now.getHours()
  const m      = now.getMinutes()
  const dayMap = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const day    = dayMap[now.getDay()]
  const dayConfig = config[day] ?? config.days?.[day]

  // Se tem config por dia
  if (dayConfig) {
    if (!dayConfig.available) return true
    const [startH, startM] = (dayConfig.start ?? '00:00').split(':').map(Number)
    const [endH,   endM]   = (dayConfig.end   ?? '23:59').split(':').map(Number)
    const cur   = h * 60 + m
    const start = startH * 60 + startM
    const end   = endH   * 60 + endM
    return cur < start || cur >= end
  }

  // Fallback: nunca bloqueia se tem config mas não tem o dia
  return false
}

// ─── Transcrição ──────────────────────────────────────────────

async function transcribeAudio(
  mediaUrl:  string | undefined,
  messageId: string,
  userId:    string,
  tenantId:  string
): Promise<{ text: string; usedFallback: boolean }> {
  if (!mediaUrl) {
    return { text: 'Não consegui ouvir o áudio, pode escrever?', usedFallback: true }
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file:     fs.createReadStream(mediaUrl) as any,
      model:    'whisper-1',
      language: 'pt',
    })

    await supabase.from('messages')
      .update({ transcription: transcription.text, status: 'processed' })
      .eq('id', messageId)

    return { text: transcription.text, usedFallback: false }
  } catch (err) {
    console.error(`[PIPELINE:${tenantId}] Transcrição falhou:`, err)
    return { text: 'Não consegui ouvir o áudio, pode escrever?', usedFallback: true }
  } finally {
    if (fs.existsSync(mediaUrl)) fs.unlinkSync(mediaUrl)
  }
}

// ─── Pipeline principal ───────────────────────────────────────

export async function runPipeline(
  event:   InboundEvent,
  runtime: TenantRuntime
): Promise<void> {
  const { tenant, agent, waSession, currentArcs } = runtime
  const pipelineStart = Date.now()
  let conversationId: string | undefined

  try {
    // ── 0. GUARDRAILS ──────────────────────────────────────────
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, is_blocked')
      .eq('phone', event.phone)
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    const guardrail = await runGuardrails({
      userId:      existingUser?.id ?? 'unknown',
      tenantId:    tenant.id,
      waMessageId: event.wa_message_id,
    })

    if (guardrail.verdict === 'block') {
      console.warn(`[PIPELINE:${tenant.slug}] Guardrail bloqueou: ${guardrail.reason}`)
      return
    }

    // ── 1. INGEST ──────────────────────────────────────────────
    const ctx = await ingest(event, agent, tenant)
    conversationId = ctx.conversation.id

    if (ctx.conversation.status === 'paused') {
      console.log(`[PIPELINE:${tenant.slug}] Conversa pausada — atendimento humano ativo`)
      return
    }

    if (isSleepTime(agent)) {
      console.log(`[PIPELINE:${tenant.slug}] Fora do horário — mensagem salva`)
      return
    }

    const lockAcquired = await waitForConversationLock(ctx.conversation.id)
    if (!lockAcquired) {
      console.warn(`[PIPELINE:${tenant.slug}] Conversa ${ctx.conversation.id} timeout no lock — descartando`)
      return
    }

    // ── 2. TRANSCRIÇÃO / NORMALIZAÇÃO ──────────────────────────
    if (event.type === 'audio') {
      const stt = await transcribeAudio(event.media_url, ctx.inboundMessage.id, ctx.user.id, tenant.id)
      ctx.textContent = stt.text
      if (stt.usedFallback) {
        await waSession.sendText(ctx.user.phone, ctx.textContent, ctx.wa_jid)
        return
      }
    }

    if (event.type === 'location' && event.location) {
      const { lat, lng, name, address } = event.location
      const parts = [`[O usuário enviou uma localização: latitude ${lat}, longitude ${lng}`]
      if (name)    parts.push(`Nome: ${name}`)
      if (address) parts.push(`Endereço: ${address}`)
      parts.push(`Link: https://maps.google.com/?q=${lat},${lng}]`)
      ctx.textContent = parts.join('. ')
    }

    if (!ctx.textContent?.trim()) return

    // ── 3. CONTEXT ─────────────────────────────────────────────
    const { messages } = await buildContext(agent, ctx.conversation, ctx.user, ctx.textContent, tenant.id)

    // ── 4. BEHAVIOR ────────────────────────────────────────────
    // Behavior simplificado — pode ser expandido com os engines do SpiceHOT
    const behaviorProfile: BehaviorProfile = buildDefaultBehavior(agent, ctx.conversation.relationship_level)
    const engagementProfile: EngagementProfile = buildDefaultEngagement()
    const safetyProfile: SafetyProfile = buildDefaultSafety()

    // ── 5. LLM ─────────────────────────────────────────────────
    const llmStart = Date.now()
    let llmResult

    try {
      llmResult = await generateResponse(messages, agent, {
        user_id:         ctx.user.id,
        conversation_id: ctx.conversation.id,
        message_id:      ctx.inboundMessage.id,
      })
    } catch (err) {
      console.error(`[PIPELINE:${tenant.slug}] LLM falhou:`, err)
      await waSession.sendText(ctx.user.phone, 'Um segundo... 🙂', ctx.wa_jid)
      return
    }

    const technicalMs = Date.now() - llmStart

    const emptyGuard = guardEmptyResponse(llmResult.text)
    if (emptyGuard.verdict !== 'allow') {
      llmResult.text = 'hmm, me dá um segundo...'
    }

    // ── 6. DELAY ───────────────────────────────────────────────
    const baseDelay  = calculateDelay('text', ctx.textContent.length, agent as any, technicalMs)
    const remainingMs = Math.max(0, baseDelay.behavioral_ms - technicalMs)
    await new Promise(r => setTimeout(r, remainingMs))

    // ── 7. DELIVERY via NLD ────────────────────────────────────
    const nldCtx: NLDContext = {
      behaviorProfile,
      engagementProfile,
      safetyProfile,
      relationshipLevel: ctx.conversation.relationship_level,
    }

    try {
      await runNLD(llmResult.text, nldCtx, ctx.user.phone, waSession.sendText.bind(waSession), ctx.wa_jid, event.is_combined ? ctx.wa_message_id : undefined)
    } catch (err) {
      console.error(`[PIPELINE:${tenant.slug}] Delivery falhou:`, err)
      try { await waSession.sendText(ctx.user.phone, llmResult.text, ctx.wa_jid) } catch { /* perdido */ }
    }

    // ── 7b. LOCATION PIN ───────────────────────────────────────
    if (
      agent.location_enabled &&
      agent.location_lat != null &&
      agent.location_lng != null &&
      isLocationRequest(ctx.textContent)
    ) {
      try {
        await waSession.sendLocation(
          ctx.user.phone,
          agent.location_lat,
          agent.location_lng,
          agent.location_name  ?? undefined,
          agent.location_address ?? undefined,
          ctx.wa_jid
        )
        console.log(`[PIPELINE:${tenant.slug}] Location pin enviado para ${ctx.user.phone}`)
      } catch (err) {
        console.error(`[PIPELINE:${tenant.slug}] Falha ao enviar location pin:`, err)
      }
    }

    // Persiste outbound
    await supabase.from('messages').insert({
      tenant_id:       tenant.id,
      conversation_id: ctx.conversation.id,
      user_id:         ctx.user.id,
      agent_id:        agent.id,
      direction:       'outbound',
      role:            'assistant',
      type:            'text',
      content:         llmResult.text,
      status:          'sent',
      metadata: {
        model:             llmResult.model,
        tokens_prompt:     llmResult.tokens_prompt,
        tokens_completion: llmResult.tokens_completion,
        delay_ms:          baseDelay.behavioral_ms,
      },
    })

    await supabase.from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', ctx.conversation.id)

    // ── 8. NOTIFICAÇÃO async ───────────────────────────────────
    if (agent.notification_enabled && agent.notification_phone) {
      detectBusinessEvent(messages, llmResult.text)
        .then(result => notifyOwner(agent, ctx.user.phone, (ctx.user as any).display_name, result, waSession, messages))
        .catch(() => {})
    }

    // ── 9. MEMORY async ────────────────────────────────────────
    updateMemoryAsync(ctx, agent.id, tenant.id).catch(() => {})

    const pipelineMs = Date.now() - pipelineStart
    console.log(`[PIPELINE:${tenant.slug}] OK ${pipelineMs}ms | delay=${remainingMs}ms`)

  } catch (err) {
    console.error(`[PIPELINE:${tenant.slug}] Erro fatal:`, err)
  } finally {
    if (conversationId) releaseConversationLock(conversationId)
  }
}

// ─── Behavior padrão ──────────────────────────────────────────
// Pode ser expandido com behavior/engagement engines do SpiceHOT

function buildDefaultBehavior(agent: any, relLevel: number): BehaviorProfile {
  const styleMap: Record<string, Partial<BehaviorProfile>> = {
    casual:    { mood_state: 'calm',        emoji_level: 'light',    flirt_level: 0 },
    formal:    { mood_state: 'calm',        emoji_level: 'none',     flirt_level: 0 },
    playful:   { mood_state: 'playful',     emoji_level: 'moderate', flirt_level: 0.1 },
    intimate:  { mood_state: 'affectionate', emoji_level: 'light',   flirt_level: 0.3 },
  }

  const style = styleMap[agent.response_style ?? 'casual'] ?? styleMap['casual']

  return {
    presence_state:             'available',
    mood_state:                 style.mood_state ?? 'calm',
    relationship:               {
      level: relLevel, label: 'comfortable', proximity: 0.5,
      emotional_openness: 0.5, memory_usage: 0.5, curiosity: 0.4, response_depth: 0.5,
    },
    response_length:            'medium',
    emotional_intensity:        relLevel >= 3 ? 'medium' : 'low',
    curiosity_level:            0.4,
    initiative_level:           0.4,
    flirt_level:                style.flirt_level ?? 0,
    imperfection_level:         0.3,
    emoji_level:                style.emoji_level ?? 'light',
    ask_question:               true,
    audio_probability_modifier: 1,
    delay_modifier:             1,
  }
}

function buildDefaultEngagement(): EngagementProfile {
  return {
    should_recall:      false,
    recall_type:        'no_continuity',
    recall_hint:        null,
    arc_type:           'casual',
    variation_style:    'statement_question',
    forbidden_openings: [],
    last_arc_opening:   null,
    attachment:         { closeness_level: 0.5, warmth: 0.6, emotional_depth: 0.4, restraint: 0.4 },
    emotional_pacing:   'maintain',
    hook_type:          'none',
    hook_hint:          null,
    ask_follow_up:      true,
  }
}

function buildDefaultSafety(): SafetyProfile {
  return {
    allowed:             true,
    risk_level:          'low',
    behavior_override:   null,
    engagement_override: null,
    delay_override_ms:   null,
    audio_allowed:       true,
    max_response_length: null,
    force_neutral_tone:  false,
    should_quarantine:   false,
    should_log_security: false,
    moderation_action:   'allow',
  }
}

// ─── Memory async ─────────────────────────────────────────────

async function updateMemoryAsync(ctx: any, agentId: string, tenantId: string): Promise<void> {
  // Placeholder — implementar extração de fatos via LLM
  // (mesma lógica do SpiceHOT memory.module.ts, adaptada para tenant_id)
}
