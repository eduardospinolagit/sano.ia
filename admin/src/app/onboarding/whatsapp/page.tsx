'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter }                         from 'next/navigation'
import { QRCodeSVG }                         from 'qrcode.react'
import { useTenant }                         from '@/hooks/use-tenant'
import { useOnboardingStore }                from '@/store/onboarding-store'
import { createClient }                      from '@/lib/supabase/client'
import { OnboardingShell }                   from '../_components/onboarding-shell'
import { Loader2, Smartphone, CheckCircle2 } from 'lucide-react'

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000').trim()

type WAStatus = 'disconnected' | 'connecting' | 'qr_pending' | 'connected'

export default function WhatsAppOnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { tenant, agent } = useTenant()
  const store    = useOnboardingStore()

  const [waStatus,  setWaStatus]  = useState<WAStatus>('disconnected')
  const [qrCode,    setQrCode]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [connected, setConnected] = useState(false)

  async function saveOnboarding() {
    if (!agent || !tenant || saving) return
    setSaving(true)
    try {
      const nicheLabel = store.niche.trim()
      const baseName   = store.agentName || 'o assistente'
      const nichemsg   = nicheLabel ? ` de ${nicheLabel}` : ''

      await supabase.from('agents').update({
        name:                  store.agentName  || agent.name,
        objective:             store.objective  || 'general',
        response_style:        store.style      || 'casual',
        followup_enabled:      store.followUpEnabled,
        followup_delay_hours:  store.followupDelayHours,
        followup_max_attempts: store.followupMaxAttempts,
        active_hours_config:   store.hoursConfig,
        persona_prompt:        agent.persona_prompt
          ? agent.persona_prompt
          : `Você é ${baseName}, atendente virtual${nichemsg}. Seja prestativo e objetivo.`,
      }).eq('id', agent.id)

      const knowledgeInserts: any[] = []

      if (nicheLabel) {
        knowledgeInserts.push({
          tenant_id: tenant.id,
          title:     'Tipo de negócio',
          content:   nicheLabel,
          is_active: true,
        })
      }

      if (store.products.trim()) {
        knowledgeInserts.push({
          tenant_id: tenant.id,
          title:     'Produtos e Serviços',
          content:   store.products.trim(),
          is_active: true,
        })
      }

      if (knowledgeInserts.length > 0) {
        await supabase.from('knowledge_entries').insert(knowledgeInserts)
      }

      await fetch(`${SERVER_URL}/tenants/${tenant.id}/agent/reload`, { method: 'POST' }).catch(() => {})
    } finally {
      setSaving(false)
    }
  }

  const fetchStatus = useCallback(async () => {
    if (!tenant) return
    try {
      const res  = await fetch(`${SERVER_URL}/tenants/${tenant.id}/wa/status`)
      const data = await res.json()
      const st   = (data.wa_status ?? 'disconnected') as WAStatus
      setWaStatus(st)
      setQrCode(data.qr_code ?? null)

      if (st === 'connected' && !connected) {
        setConnected(true)
        await saveOnboarding()
        setTimeout(() => router.push('/onboarding/success'), 1_200)
      }
    } catch { /* servidor offline */ }
  }, [tenant, connected]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tenant) return
    fetch(`${SERVER_URL}/tenants/${tenant.id}/wa/connect`, { method: 'POST' }).catch(() => {})
    fetchStatus()
    const interval = setInterval(fetchStatus, 3_000)
    return () => clearInterval(interval)
  }, [tenant, fetchStatus])

  const statusLabel: Record<WAStatus, string> = {
    disconnected: 'Iniciando conexão...',
    connecting:   'Conectando...',
    qr_pending:   'Aguardando conexão',
    connected:    'Conectado',
  }

  return (
    <OnboardingShell step={5}>
      <div className="space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Conecte seu WhatsApp
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Escaneie o QR code com seu WhatsApp Business
          </p>
        </div>

        {/* QR Code */}
        {(waStatus === 'qr_pending' || waStatus === 'connecting') && (
          <div
            className="rounded-2xl p-6 text-center space-y-5 animate-fade-up"
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
          >
            {waStatus === 'qr_pending' && qrCode ? (
              <>
                <div className="flex justify-center">
                  <div
                    className="p-4 rounded-2xl"
                    style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}
                  >
                    <QRCodeSVG value={qrCode} size={200} level="M" includeMargin={false} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium" style={{ color: '#0F172A' }}>
                    Abra o WhatsApp no celular
                  </p>
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    Vá em <strong style={{ color: '#0F172A' }}>Dispositivos vinculados</strong> e depois em <strong style={{ color: '#0F172A' }}>Vincular dispositivo</strong>
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#22c55e' }} />
                <p className="text-sm" style={{ color: '#64748B' }}>Gerando QR code...</p>
              </div>
            )}
          </div>
        )}

        {/* Conectado */}
        {waStatus === 'connected' && (
          <div
            className="rounded-2xl p-8 text-center space-y-4 animate-fade-up"
            style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'rgba(34,197,94,.1)' }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: '#22c55e' }} />
            </div>
            <div>
              <p className="font-semibold text-lg" style={{ color: '#16a34a' }}>Conectado!</p>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>
                {saving ? 'Configurando seu agente...' : 'Redirecionando...'}
              </p>
            </div>
            {saving && <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: '#22c55e' }} />}
          </div>
        )}

        {/* Disconnected: iniciando */}
        {waStatus === 'disconnected' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#22c55e' }} />
            <p className="text-sm" style={{ color: '#64748B' }}>Iniciando conexão...</p>
          </div>
        )}

        {/* Status chip */}
        <div className="flex items-center justify-center gap-2">
          <Smartphone className="w-4 h-4" style={{ color: '#94A3B8' }} />
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            {statusLabel[waStatus]}
          </span>
        </div>

      </div>
    </OnboardingShell>
  )
}
