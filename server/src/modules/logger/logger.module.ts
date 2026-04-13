/**
 * logger.module.ts
 *
 * Registra eventos técnicos na tabela `logs` e no console.
 * Todos os módulos do pipeline chamam este logger.
 */

import supabase from '../../services/supabase.service'

type LogLevel     = 'info' | 'warn' | 'error'
export type LogEventType =
  | 'incoming_message'   | 'outgoing_message'
  | 'transcription_ok'   | 'transcription_failed'
  | 'llm_ok'             | 'llm_failed'
  | 'audio_generated'    | 'audio_failed'
  | 'memory_updated'     | 'summary_generated'
  | 'whatsapp_connect'   | 'whatsapp_disconnect'   | 'whatsapp_qr'
  | 'user_created'       | 'user_blocked'
  | 'delay_applied'      | 'delivery_failed'
  | 'behavior_computed'
  | 'engagement_computed'
  | 'pipeline_error'
  // Jobs
  | 'job_started'        | 'job_completed'         | 'job_failed'
  // Evaluation
  | 'evaluation_started' | 'evaluation_completed'  | 'evaluation_failed'
  // Experimentation
  | 'experiment_created' | 'experiment_started'
  | 'experiment_paused'  | 'experiment_completed'
  | 'rollout_created'    | 'rollout_increased'      | 'rollout_rollback'
  | 'version_created'    | 'version_baseline_set'
  // Safety
  | 'safety_applied'     | 'risk_detected'
  | 'limit_exceeded'     | 'moderation_action'
  | 'anomaly_detected'   | 'conversation_quarantined'
  // Growth
  | 'onboarding_advanced'  | 'quota_exceeded'         | 'quota_nearing'
  | 'upgrade_cta_shown'    | 'plan_changed'           | 'trial_started'
  | 'reactivation_sent'    | 'funnel_event'
  // Audio Library
  | 'audio_library_played' | 'audio_library_skipped'  | 'audio_library_upload'
  // NLD
  | 'nld_applied'

interface LogEntry {
  level?:           LogLevel   // opcional — padrão 'info'
  event_type:       LogEventType
  user_id?:         string
  conversation_id?: string
  message_id?:      string
  payload?:         Record<string, unknown>
  error_message?:   string
  stack_trace?:     string
}

export async function log(entry: LogEntry): Promise<void> {
  const level = entry.level ?? 'info'
  // Console output
  const prefix = `[${level.toUpperCase()}] ${entry.event_type}`
  if (entry.level === 'error') {
    console.error(prefix, entry.error_message ?? '', entry.payload ?? '')
  } else {
    console.log(prefix, entry.payload ?? '')
  }

  // Persistência no banco (fire-and-forget — nunca bloqueia o pipeline)
  supabase
    .from('logs')
    .insert({
      level:           level,
      event_type:      entry.event_type,
      user_id:         entry.user_id        ?? null,
      conversation_id: entry.conversation_id ?? null,
      message_id:      entry.message_id     ?? null,
      payload:         entry.payload        ?? null,
      error_message:   entry.error_message  ?? null,
      stack_trace:     entry.stack_trace    ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[LOGGER] Falha ao persistir log:', error.message)
    })
}

// Atalhos semânticos
export const logger = {
  info:  (event_type: LogEventType, payload?: Record<string, unknown>, ctx?: Partial<LogEntry>) =>
    log({ level: 'info',  event_type, payload, ...ctx }),

  warn:  (event_type: LogEventType, payload?: Record<string, unknown>, ctx?: Partial<LogEntry>) =>
    log({ level: 'warn',  event_type, payload, ...ctx }),

  error: (event_type: LogEventType, err: unknown, ctx?: Partial<LogEntry>) => {
    const e = err instanceof Error ? err : new Error(String(err))
    return log({
      level:         'error',
      event_type,
      error_message: e.message,
      stack_trace:   e.stack,
      ...ctx,
    })
  },
}
