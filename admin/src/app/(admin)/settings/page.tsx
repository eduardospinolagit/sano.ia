'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant }     from '@/hooks/use-tenant'
import { User, Building2 } from 'lucide-react'

export default function SettingsPage() {
  const { tenant } = useTenant()
  const supabase   = createClient()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">

      <div>
        <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
          Configurações
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
          Informações da sua conta e workspace
        </p>
      </div>

      {/* Conta */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,.1)' }}
          >
            <User className="w-4 h-4" style={{ color: '#22c55e' }} />
          </div>
          <h2 className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>
            Conta
          </h2>
        </div>
        <Row label="Email" value={email || '...'} />
      </section>

      {/* Workspace */}
      <section
        className="rounded-2xl overflow-hidden"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid #F1F5F9' }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,.1)' }}
          >
            <Building2 className="w-4 h-4" style={{ color: '#3B82F6' }} />
          </div>
          <h2 className="font-heading text-sm font-semibold" style={{ color: '#0F172A' }}>
            Workspace
          </h2>
        </div>
        <Row label="Nome"  value={tenant?.name  ?? '...'} />
        <Row label="Slug"  value={tenant?.slug  ?? '...'} mono />
        <Row
          label="Plano"
          value={
            tenant?.status === 'active'
              ? <span className="badge badge-green">Ativo</span>
              : <span className="badge badge-gray">{tenant?.status ?? '...'}</span>
          }
        />
      </section>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderTop: '1px solid #F1F5F9' }}
    >
      <span className="text-sm" style={{ color: '#64748B' }}>{label}</span>
      <span
        className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}
        style={{ color: '#0F172A' }}
      >
        {value}
      </span>
    </div>
  )
}
