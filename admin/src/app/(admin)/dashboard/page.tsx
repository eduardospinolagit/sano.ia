'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient }  from '@/lib/supabase/client'
import { useTenant }     from '@/hooks/use-tenant'
import { ArrowRight }    from 'lucide-react'
import { useRouter }     from 'next/navigation'

export default function DashboardPage() {
  const { tenant, agent, waStatus, loading } = useTenant()
  const supabase = createClient()

  const [msgs,       setMsgs]       = useState<number | null>(null)
  const [convs,      setConvs]      = useState<number | null>(null)
  const [active,     setActive]     = useState<number | null>(null)
  const [recent,     setRecent]     = useState<any[]>([])
  const [leadsHot,     setLeadsHot]     = useState<number | null>(null)
  const [leadsMid,     setLeadsMid]     = useState<number | null>(null)
  const [leadsCold,    setLeadsCold]    = useState<number | null>(null)
  const [hotLeadList,  setHotLeadList]  = useState<any[]>([])
  const [showHotList,  setShowHotList]  = useState(false)

  useEffect(() => {
    if (!tenant) return
    loadStats()
  }, [tenant])

  async function loadStats() {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).gte('created_at', today.toISOString()),
      supabase.from('conversations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).gte('started_at', today.toISOString()),
      supabase.from('conversations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).eq('status', 'active'),
      supabase.from('conversations')
        .select('id, status, last_message_at, user:users!user_id(phone, display_name)')
        .eq('tenant_id', tenant!.id)
        .order('last_message_at', { ascending: false })
        .limit(8),
      // Leads quentes: relationship_level >= 4
      supabase.from('conversations').select('id, relationship_level, status, user:users!user_id(phone, display_name)')
        .eq('tenant_id', tenant!.id).gte('relationship_level', 4)
        .order('relationship_level', { ascending: false }).limit(20),
      // Leads em andamento: relationship_level 2-3
      supabase.from('conversations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).gte('relationship_level', 2).lte('relationship_level', 3),
      // Leads frios/curiosos: relationship_level 0-1
      supabase.from('conversations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant!.id).lte('relationship_level', 1),
    ])
    setMsgs(r1.count ?? 0)
    setConvs(r2.count ?? 0)
    setActive(r3.count ?? 0)
    setRecent(r4.data ?? [])
    setLeadsHot(r5.data?.length ?? 0)
    setHotLeadList(r5.data ?? [])
    setLeadsMid(r6.count ?? 0)
    setLeadsCold(r7.count ?? 0)
  }

  const waConnected = waStatus === 'connected'
  const waBadge = {
    connected:    { label: 'WhatsApp conectado',     color: '#16a34a', dot: '#22c55e' },
    qr_pending:   { label: 'WhatsApp desconectado',  color: '#94A3B8', dot: '#CBD5E1' },
    connecting:   { label: 'WhatsApp desconectado',  color: '#94A3B8', dot: '#CBD5E1' },
    disconnected: { label: 'WhatsApp desconectado',  color: '#94A3B8', dot: '#CBD5E1' },
  }[waStatus ?? 'disconnected']

  const stats = [
    { label: 'Mensagens hoje',  value: msgs   },
    { label: 'Conversas hoje',  value: convs  },
    { label: 'Ativas agora',    value: active },
    { label: 'Agente',          value: agent?.name ?? null, isText: true },
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-10 animate-fade-in">

      {/* Badge status */}
      <div className="flex justify-end">
        {waConnected ? (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
            <span className="text-xs font-medium" style={{ color: '#16a34a' }}>Agente ativo</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#CBD5E1' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>WhatsApp desconectado</span>
          </div>
        )}
      </div>

      {/* Banner WhatsApp desconectado */}
      {!waConnected && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
        >
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#F59E0B' }} />
            <span className="text-sm" style={{ color: '#92400E' }}>
              Seu agente está parado. WhatsApp não conectado
            </span>
          </div>
          <Link
            href="/whatsapp"
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors duration-150 shrink-0"
            style={{ background: '#F59E0B', color: '#FFFFFF' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#D97706')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F59E0B')}
          >
            Conectar agora
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: '#F1F5F9', borderRadius: 16, overflow: 'hidden' }}>
        {stats.map(({ label, value, isText }) => (
          <div
            key={label}
            className="flex flex-col justify-between p-6"
            style={{ background: '#FFFFFF' }}
          >
            <p className="text-xs" style={{ color: '#94A3B8' }}>{label}</p>
            {loading || value === null ? (
              <div className="skeleton h-8 w-12 mt-3" />
            ) : (
              <p
                className="font-heading font-semibold mt-3 truncate"
                style={{
                  color:      '#0F172A',
                  fontSize:   30,
                  lineHeight: 1,
                }}
              >
                {isText
                  ? <span style={{ fontSize: 15, fontWeight: 500 }}>{value}</span>
                  : value
                }
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Leads */}
      <div>
        <h2 className="text-sm font-medium mb-4" style={{ color: '#0F172A' }}>Leads</h2>
        <div className="grid grid-cols-2 gap-3">

          {/* Quentes — maior */}
          <div
            className="rounded-xl p-5 flex flex-col gap-4 row-span-2"
            style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                <span className="text-xs font-medium" style={{ color: '#0F172A' }}>Leads quentes</span>
              </div>
              {leadsHot !== null && leadsHot > 0 && (
                <button
                  onClick={() => setShowHotList(v => !v)}
                  className="text-xs transition-opacity hover:opacity-60 cursor-pointer"
                  style={{ color: '#94A3B8' }}
                >
                  {showHotList ? 'Ocultar' : 'Ver todos'}
                </button>
              )}
            </div>

            {loading || leadsHot === null
              ? <div className="skeleton h-10 w-12" />
              : <p className="font-heading font-semibold" style={{ color: '#0F172A', fontSize: 42, lineHeight: 1 }}>{leadsHot}</p>
            }

            {showHotList && hotLeadList.length > 0 && (
              <div className="space-y-2 pt-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                {hotLeadList.map(conv => {
                  const user = conv.user as any
                  const name = user?.display_name ?? user?.phone ?? conv.id.slice(0, 8)
                  const intention = INTENTION_LABELS[conv.relationship_level] ?? '—'
                  return (
                    <div key={conv.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{name}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{intention}</p>
                      </div>
                      <Link
                        href="/conversations"
                        className="text-xs px-2.5 py-1 rounded-lg shrink-0 transition-colors duration-150"
                        style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', color: '#64748B' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#F1F5F9')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F8FAFC')}
                      >
                        Ver →
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Em andamento — menor */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#F59E0B' }} />
              <span className="text-xs" style={{ color: '#64748B' }}>Em andamento</span>
            </div>
            {loading || leadsMid === null
              ? <div className="skeleton h-6 w-8" />
              : <p className="font-heading text-xl font-semibold" style={{ color: '#0F172A', lineHeight: 1 }}>{leadsMid}</p>
            }
          </div>

          {/* Frios / Curiosos — menor */}
          <div
            className="rounded-xl p-4 space-y-2"
            style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#CBD5E1' }} />
              <span className="text-xs" style={{ color: '#64748B' }}>Frios / Curiosos</span>
            </div>
            {loading || leadsCold === null
              ? <div className="skeleton h-6 w-8" />
              : <p className="font-heading text-xl font-semibold" style={{ color: '#0F172A', lineHeight: 1 }}>{leadsCold}</p>
            }
          </div>

        </div>
      </div>

      {/* Conversas recentes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium" style={{ color: '#0F172A' }}>
            Conversas recentes
          </h2>
          <Link
            href="/conversations"
            className="flex items-center gap-1 text-xs transition-opacity hover:opacity-60"
            style={{ color: '#94A3B8' }}
          >
            Ver todas <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div
          className="rounded-2xl overflow-hidden divide-y"
          style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}
        >
          {loading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton h-3 w-28" />
                    <div className="skeleton h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm" style={{ color: '#CBD5E1' }}>
                Aguardando primeira interação
              </p>
            </div>
          ) : (
            recent.map((conv) => {
              const user = conv.user as any
              const name = user?.display_name ?? user?.phone ?? conv.id.slice(0, 8)
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{ borderColor: '#F8FAFC' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                    style={{ background: '#F8FAFC', color: '#94A3B8' }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#0F172A' }}>{name}</p>
                    {conv.last_message_at && (
                      <p className="text-xs mt-0.5" style={{ color: '#CBD5E1' }}>
                        {timeAgo(conv.last_message_at)}
                      </p>
                    )}
                  </div>

                  <StatusDot status={conv.status} />
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Status do agente */}
      {agent && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium" style={{ color: '#0F172A' }}>
              Status do agente
            </h2>
            <Link
              href="/agent"
              className="text-xs transition-opacity hover:opacity-60"
              style={{ color: '#94A3B8' }}
            >
              Configurar →
            </Link>
          </div>

          <div
            className="rounded-2xl divide-y"
            style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}
          >
            <AgentRow
              label="Objetivo"
              value={OBJECTIVE_LABELS[agent.objective] ?? agent.objective ?? '—'}
            />
            <AgentRow
              label="Agente"
              value={waConnected && agent.is_active !== false ? 'Ativo' : 'Inativo'}
              valueColor={waConnected && agent.is_active !== false ? '#16a34a' : '#94A3B8'}
            />
            <AgentRow
              label="Follow-up"
              value={agent.followup_enabled ? 'Ativo' : 'Inativo'}
              valueColor={agent.followup_enabled ? '#16a34a' : '#94A3B8'}
            />
          </div>
        </div>
      )}

    </div>
  )
}

const INTENTION_LABELS: Record<number, string> = {
  5: 'Pronto para comprar',
  4: 'Interesse alto',
}

const OBJECTIVE_LABELS: Record<string, string> = {
  general:      'Atendimento geral',
  scheduling:   'Marcar reuniões',
  quote:        'Enviar orçamentos',
  lead_qualify: 'Qualificar leads',
  sales:        'Venda direta',
  support:      'Suporte técnico',
  survey:       'Pesquisa / feedback',
  custom:       'Personalizado',
}

const STYLE_LABELS: Record<string, string> = {
  casual:   'Casual',
  formal:   'Formal',
  playful:  'Animado',
  intimate: 'Próximo',
}

function AgentRow({
  label, value, valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderColor: '#F8FAFC' }}
    >
      <span className="text-sm" style={{ color: '#94A3B8' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: valueColor ?? '#0F172A' }}>
        {value}
      </span>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active' ? '#22c55e' :
    status === 'paused' ? '#F59E0B' : '#E2E8F0'
  return (
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora mesmo'
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}
