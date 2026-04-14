/**
 * types/index.ts — Tipos centrais do Sano.ia
 *
 * Multi-tenant: toda entidade de dados pertence a um tenant.
 * O "agent" (companion no SpiceHOT) é a configuração do agente do tenant.
 */

// ─── Tenant ───────────────────────────────────────────────────

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'canceled'

export interface Tenant {
  id:            string
  name:          string
  slug:          string
  email:         string
  status:        TenantStatus
  plan_id?:      string
  trial_ends_at?: string
  created_at:    string
  updated_at:    string
}

export type WAStatus = 'disconnected' | 'connecting' | 'qr_pending' | 'connected'

export interface TenantWASession {
  id:                string
  tenant_id:         string
  auth_dir:          string
  wa_status:         WAStatus
  wa_phone?:         string
  last_connected_at?: string
  qr_expires_at?:    string
  created_at:        string
}

// ─── Agent (configuração do agente por tenant) ────────────────

export interface Agent {
  id:                       string
  tenant_id:                string
  name:                     string
  is_active:                boolean
  persona_prompt:           string
  system_rules?:            string
  model_name:               string
  temperature:              number
  voice_id?:                string
  audio_reply_probability:  number
  delay_profile?:           DelayProfile | null
  active_hours_config?:     ActiveHoursConfig | null
  response_style:           'casual' | 'formal' | 'playful' | 'intimate'
  relationship_level_max:   number
  objective:                string
  objective_meta?:          Record<string, any> | null
  followup_enabled:         boolean
  followup_delay_hours:     number
  followup_messages?:       any[] | null
  followup_max_attempts:    number
  language?:                string
  max_tokens?:              number
  location_enabled:         boolean
  location_lat?:            number | null
  location_lng?:            number | null
  location_name?:           string | null
  location_address?:        string | null
  notification_enabled:     boolean
  notification_phone?:      string | null
  notification_fields?:     string[] | null
  created_at:               string
  updated_at:               string
}

// ─── Knowledge Base ───────────────────────────────────────────

export interface KnowledgeEntry {
  id:         string
  tenant_id:  string
  title:      string
  content:    string
  is_active:  boolean
  created_at: string
  updated_at: string
}

// ─── User (contato que conversa com o agente) ─────────────────

export interface User {
  id:            string
  tenant_id:     string
  phone:         string
  display_name?: string
  timezone?:     string
  origin?:       string
  is_blocked:    boolean
  first_seen_at: string
  last_seen_at:  string
  created_at:    string
  updated_at?:   string
}

// ─── Conversation ─────────────────────────────────────────────

export interface Conversation {
  id:                 string
  tenant_id:          string
  user_id:            string
  agent_id:           string
  status:             'active' | 'paused' | 'closed'
  relationship_level: number
  emotional_state?:   string | null
  summary?:           string | null
  started_at:         string
  last_message_at?:   string | null
  created_at:         string
  updated_at?:        string
}

// ─── Message ──────────────────────────────────────────────────

export interface Message {
  id:              string
  tenant_id:       string
  conversation_id: string
  user_id:         string
  agent_id:        string
  direction:       'inbound' | 'outbound'
  role:            'user' | 'assistant' | 'system'
  type:            'text' | 'audio' | 'image'
  content?:        string | null
  media_url?:      string | null
  transcription?:  string | null
  status:          'received' | 'processed' | 'sent' | 'failed'
  metadata?:       Record<string, any> | null
  created_at:      string
}

// ─── UserMemory ───────────────────────────────────────────────

export interface UserMemory {
  id:           string
  tenant_id:    string
  user_id:      string
  agent_id:     string
  memory_type:  'identity' | 'preference' | 'emotional' | 'history' | 'sensitive'
  memory_key:   string
  memory_value: string
  confidence:   number
  source?:      string
  created_at:   string
  updated_at?:  string
}

// ─── Inbound Event (do WhatsApp) ─────────────────────────────

export interface InboundEvent {
  tenant_id:     string   // resolvido pelo WASession antes de entrar no pipeline
  phone:         string   // número real (ou LID se não foi possível resolver)
  lid_phone?:    string   // LID original quando phone foi resolvido de um @lid JID
  push_name?:    string   // nome do contato no WhatsApp (pushName do Baileys)
  type:          'text' | 'audio' | 'image' | 'location'
  content?:      string
  media_url?:    string
  location?:     { lat: number; lng: number; name?: string; address?: string }
  wa_message_id?: string
  wa_jid?:       string
  is_combined?:  boolean   // true quando debounce uniu múltiplas mensagens
}

// ─── Pipeline Context ─────────────────────────────────────────

export interface PipelineContext {
  tenant:          Tenant
  agent:           Agent
  user:            User
  conversation:    Conversation
  inboundMessage:  Message
  textContent:     string
  wa_jid?:         string
  wa_message_id?:  string
}

// ─── LLM ─────────────────────────────────────────────────────

export interface LLMResponse {
  text:               string
  model:              string
  tokens_prompt:      number
  tokens_completion:  number
  latency_ms:         number
}

// ─── Delay ───────────────────────────────────────────────────

export interface DelayProfile {
  text_short_min_s: number
  text_short_max_s: number
  text_long_min_s:  number
  text_long_max_s:  number
  audio_min_s:      number
  audio_max_s:      number
  busy_extra_min_s: number
  busy_extra_max_s: number
  jitter_pct:       number
}

export interface ActiveHoursConfig {
  [day: string]: {
    morning?:   { start: string; end: string; available: boolean }
    afternoon?: { start: string; end: string; available: boolean }
    night?:     { start: string; end: string; available: boolean }
  }
}

export interface DelayResult {
  technical_ms:  number
  behavioral_ms: number
  total_ms:      number
}

// ─── Behavior / Engagement / Safety ──────────────────────────
// (compatibilidade com NLD e módulos copiados do SpiceHOT)

export interface BehaviorProfile {
  presence_state:              string
  mood_state:                  string
  relationship:                RelationshipDimensions
  response_length:             string
  emotional_intensity:         string
  curiosity_level:             number
  initiative_level:            number
  flirt_level:                 number
  imperfection_level:          number
  emoji_level:                 'none' | 'light' | 'moderate'
  ask_question:                boolean
  audio_probability_modifier:  number
  delay_modifier:              number
}

export interface RelationshipDimensions {
  level:             number
  label:             string
  proximity:         number
  emotional_openness: number
  memory_usage:      number
  curiosity:         number
  response_depth:    number
}

export interface EngagementProfile {
  should_recall:      boolean
  recall_type:        string
  recall_hint:        string | null
  arc_type:           string
  variation_style:    string
  forbidden_openings: string[]
  last_arc_opening:   string | null
  attachment:         AttachmentDimensions
  emotional_pacing:   string
  hook_type:          string
  hook_hint:          string | null
  ask_follow_up:      boolean
}

export interface AttachmentDimensions {
  closeness_level: number
  warmth:          number
  emotional_depth: number
  restraint:       number
}

export interface SafetyProfile {
  allowed:             boolean
  risk_level:          'low' | 'medium' | 'high' | 'critical'
  behavior_override:   Partial<BehaviorProfile> | null
  engagement_override: Partial<EngagementProfile> | null
  delay_override_ms:   number | null
  audio_allowed:       boolean
  max_response_length: string | null
  force_neutral_tone:  boolean
  should_quarantine:   boolean
  should_log_security: boolean
  moderation_action:   'allow' | 'redirect' | 'neutralize' | 'block'
}

// ─── Guardrails ───────────────────────────────────────────────

export interface GuardrailsResult {
  verdict: 'allow' | 'block' | 'recover'
  reason:  string | null
}

// ─── Format decision ─────────────────────────────────────────

export interface FormatDecision {
  use_audio: boolean
  reason:    string
}
