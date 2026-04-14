/**
 * use-tenant.ts
 *
 * Hook central que carrega tenant + agent do usuário logado.
 * O tenant_id é resolvido via tenant_members (auth.user().email).
 */

'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient }        from '@/lib/supabase/client'

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000').trim()

export interface TenantData {
  id:     string
  name:   string
  slug:   string
  status: string
}

export interface AgentData {
  id:             string
  name:           string
  persona_prompt: string
  system_rules?:  string
  model_name:     string
  temperature:    number
  audio_reply_probability: number
  response_style: string
  active_hours_config?: any
  [key: string]: any
}

interface TenantContext {
  tenant:   TenantData | null
  agent:    AgentData  | null
  waStatus: string     | null
  loading:  boolean
}

const CACHE_KEY = 'sano_tenant_cache'

function readCache(): { tenant: TenantData; agent: AgentData | null; waStatus: string | null } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeCache(tenant: TenantData, agent: AgentData | null, waStatus: string | null) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ tenant, agent, waStatus })) } catch {}
}

export function useTenant(): TenantContext {
  const supabase  = createClient()
  const tenantRef = useRef<string | null>(null)

  const [tenant,   setTenant]   = useState<TenantData | null>(null)
  const [agent,    setAgent]    = useState<AgentData | null>(null)
  const [waStatus, setWaStatus] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setTenant(cached.tenant)
      setAgent(cached.agent)
      if (cached.waStatus) setWaStatus(cached.waStatus)
      tenantRef.current = cached.tenant.id
      setLoading(false)
    }
    load()
  }, [])

  // Polling do status WA no servidor a cada 4s
  useEffect(() => {
    if (!tenantRef.current) return
    const poll = () => fetchWaStatus(tenantRef.current!)
    poll()
    const iv = setInterval(poll, 4_000)
    return () => clearInterval(iv)
  }, [tenant])

  async function fetchWaStatus(tenantId: string) {
    try {
      const res  = await fetch(`${SERVER_URL}/tenants/${tenantId}/wa/status`)
      const data = await res.json()
      if (data.wa_status) {
        setWaStatus(data.wa_status)
        const cached = readCache()
        if (cached) writeCache(cached.tenant, cached.agent, data.wa_status)
      }
    } catch { /* servidor offline */ }
  }

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('tenant_members')
        .select('tenant_id, tenants(*)')
        .eq('user_email', user.email!)
        .not('accepted_at', 'is', null)
        .limit(1)
        .maybeSingle()

      if (!member?.tenants) return

      const t  = member.tenants as any
      const td = { id: t.id, name: t.name, slug: t.slug, status: t.status }
      tenantRef.current = t.id
      setTenant(td)

      const { data: ag } = await supabase
        .from('agents')
        .select('*')
        .eq('tenant_id', t.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      const agData = ag ? (ag as AgentData) : null
      setAgent(agData)
      writeCache(td, agData, waStatus)

    } finally {
      setLoading(false)
    }
  }

  return { tenant, agent, waStatus, loading }
}
