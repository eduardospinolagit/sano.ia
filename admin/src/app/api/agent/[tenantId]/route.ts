/**
 * PATCH /api/agent/[tenantId]
 *
 * Salva configuração do agente usando a service key do Supabase
 * (bypassa RLS). Roda no servidor — a service key nunca fica exposta
 * no browser.
 *
 * Após salvar, tenta notificar o servidor local para recarregar o agent.
 * Essa chamada é best-effort: se o servidor estiver offline, o agente vai
 * recarregar sozinho no próximo ciclo periódico (60s).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ALLOWED_FIELDS = [
  'name', 'persona_prompt', 'system_rules', 'response_style',
  'temperature', 'objective', 'objective_meta',
  'followup_enabled', 'followup_delay_hours', 'followup_messages', 'followup_max_attempts',
  'active_hours_config',
  'notification_enabled', 'notification_phone', 'notification_fields',
  'location_enabled', 'location_lat', 'location_lng', 'location_name', 'location_address',
] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Variáveis de ambiente do Supabase não configuradas' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
  }

  const { error } = await supabase
    .from('agents')
    .update(updates)
    .eq('tenant_id', tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notifica o servidor local para recarregar o agent (best-effort)
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL ?? '').trim()
  if (serverUrl) {
    fetch(`${serverUrl}/tenants/${tenantId}/agent/reload`, { method: 'POST' })
      .catch(() => { /* servidor offline — agente recarrega no ciclo periódico */ })
  }

  return NextResponse.json({ ok: true })
}
