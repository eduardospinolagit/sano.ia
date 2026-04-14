'use client'

import { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG }  from 'qrcode.react'
import { useTenant }  from '@/hooks/use-tenant'
import { Smartphone, CheckCircle2, Loader2, WifiOff, RefreshCw } from 'lucide-react'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3002'

type WAStatus = 'disconnected' | 'connecting' | 'qr_pending' | 'connected'

export default function WhatsAppPage() {
  const { tenant } = useTenant()
  const [waStatus, setWaStatus] = useState<WAStatus>('disconnected')
  const [qrCode,   setQrCode]   = useState<string | null>(null)
  const [phone,    setPhone]     = useState<string | null>(null)
  const [loading,  setLoading]   = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!tenant) return
    try {
      const res  = await fetch(`${SERVER_URL}/tenants/${tenant.id}/wa/status`)
      const data = await res.json()
      setWaStatus(data.wa_status ?? 'disconnected')
      setQrCode(data.qr_code ?? null)
      setPhone(data.wa_phone ?? null)
    } catch { /* servidor offline */ }
  }, [tenant])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  async function handleConnect() {
    if (!tenant) return
    setLoading(true)
    try {
      await fetch(`${SERVER_URL}/tenants/${tenant.id}/wa/connect`, { method: 'POST' })
      setTimeout(fetchStatus, 1_000)
    } finally { setLoading(false) }
  }

  async function handleDisconnect() {
    if (!tenant) return
    setLoading(true)
    try {
      await fetch(`${SERVER_URL}/tenants/${tenant.id}/wa/disconnect`, { method: 'POST' })
      setWaStatus('disconnected'); setQrCode(null); setPhone(null)
    } finally { setLoading(false) }
  }

  const statusCfg = {
    connected:    { label: 'Conectado',     color: '#16a34a', dot: '#22c55e' },
    qr_pending:   { label: 'Aguardando QR', color: '#b45309', dot: '#F59E0B' },
    connecting:   { label: 'Conectando',    color: '#2563eb', dot: '#3B82F6' },
    disconnected: { label: 'Desconectado',  color: '#64748B', dot: '#CBD5E1' },
  }
  const cfg = statusCfg[waStatus]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">

      {/* Subtitle */}
      <p className="text-sm" style={{ color: '#64748B' }}>Conecte o número que o agente vai usar</p>

      {/* Status */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,.1)' }}>
            <Smartphone className="w-4 h-4" style={{ color: '#22c55e' }} />
          </div>
          <h2 className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>Status da conexão</h2>
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.dot }} />
            <div>
              <p className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                {phone
                  ? `Número: ${phone}`
                  : waStatus === 'connected'    ? 'Agente ativo e recebendo mensagens'
                  : waStatus === 'qr_pending'   ? 'Escaneie o QR code para conectar'
                  : waStatus === 'connecting'   ? 'Aguarde enquanto a conexão é estabelecida'
                  : 'Conecte o WhatsApp para o agente começar a responder'}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {waStatus === 'disconnected' && (
              <button onClick={handleConnect} disabled={loading} className="btn-primary">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Conectar'}
              </button>
            )}
            {waStatus === 'connected' && (
              <button onClick={handleDisconnect} disabled={loading} className="btn-outline">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Desconectar'}
              </button>
            )}
            {(waStatus === 'qr_pending' || waStatus === 'connecting') && (
              <button onClick={handleDisconnect} disabled={loading} className="btn-ghost">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </section>

      {/* QR Code */}
      {waStatus === 'qr_pending' && qrCode && (
        <section
          className="rounded-2xl overflow-hidden animate-fade-in"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,.1)' }}>
              <Smartphone className="w-4 h-4" style={{ color: '#b45309' }} />
            </div>
            <h2 className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>Escaneie o QR code</h2>
          </div>

          <div className="px-5 py-6 flex flex-col items-center gap-5">
            <p className="text-sm text-center" style={{ color: '#64748B' }}>
              Abra o WhatsApp, toque em{' '}
              <span className="font-medium" style={{ color: '#0F172A' }}>Dispositivos vinculados</span>
              {' '}e depois em{' '}
              <span className="font-medium" style={{ color: '#0F172A' }}>Vincular dispositivo</span>
            </p>

            <div className="p-4 rounded-2xl" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <QRCodeSVG value={qrCode} size={200} level="M" includeMargin={false} />
            </div>

            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
              <RefreshCw className="w-3 h-3" />
              Atualiza automaticamente a cada 3 segundos
            </div>
          </div>
        </section>
      )}

      {/* Conectado */}
      {waStatus === 'connected' && (
        <section
          className="rounded-2xl overflow-hidden animate-fade-in"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="px-5 py-6 flex flex-col items-center gap-1.5 text-center">
            <p className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>Agente ativo</p>
            <p className="text-sm" style={{ color: '#64748B' }}>
              {phone ? `Número ${phone} conectado e` : 'Agente'} recebendo mensagens normalmente.
            </p>
          </div>
        </section>
      )}

      {/* Instruções */}
      {waStatus === 'disconnected' && (
        <section
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,.1)' }}>
              <WifiOff className="w-4 h-4" style={{ color: '#22c55e' }} />
            </div>
            <h2 className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>Como conectar</h2>
          </div>
          <ol className="px-5 py-4 space-y-3">
            {[
              'Clique em "Conectar" acima',
              'Abra o WhatsApp no seu celular',
              'Acesse Configurações e depois Dispositivos vinculados',
              'Toque em "Vincular dispositivo" e escaneie o QR',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: '#64748B' }}>
                <span
                  className="w-5 h-5 rounded-full text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(34,197,94,.1)', color: '#16a34a' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}

    </div>
  )
}
