'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant }     from '@/hooks/use-tenant'
import { MessageSquare, Search, UserCheck, Bot } from 'lucide-react'

type Filter = 'all' | 'active' | 'paused' | 'closed'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',    label: 'Todas'    },
  { value: 'active', label: 'Ativas'   },
  { value: 'paused', label: 'Pausadas' },
  { value: 'closed', label: 'Fechadas' },
]

export default function ConversationsPage() {
  const { tenant }            = useTenant()
  const supabase              = createClient()
  const [convs,      setConvs]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<Filter>('all')
  const [search,     setSearch]     = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    if (!tenant) return
    load()
  }, [tenant, filter])

  async function togglePause(conv: any) {
    if (togglingId) return
    const nextStatus = conv.status === 'paused' ? 'active' : 'paused'
    setTogglingId(conv.id)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/tenants/${tenant!.id}/conversations/${conv.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConvs(prev => prev.map(c => c.id === conv.id ? { ...c, status: nextStatus } : c))
    } catch (err) {
      console.error('[togglePause]', err)
      alert('Não foi possível atualizar a conversa. Verifique se o servidor está rodando.')
    } finally {
      setTogglingId(null)
    }
  }

  async function load() {
    setLoading(true)
    let q = supabase
      .from('conversations')
      .select('id, status, last_message_at, relationship_level, user:users!user_id(phone, display_name)')
      .eq('tenant_id', tenant!.id)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q

    // dedup: remove LIDs (phone >13 dígitos são IDs internos do WhatsApp, não números reais)
    // e mantém só a conversa mais recente por número real
    const seen = new Set<string>()
    const deduped = (data ?? []).filter(c => {
      const phone = c.user?.phone ?? ''
      if (phone.length > 13) return false   // descarta LID
      const key = phone || c.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setConvs(deduped)
    setLoading(false)
  }

  const filtered = convs.filter(c => {
    if (!search) return true
    const user = c.users as any
    const name = (user?.display_name ?? user?.phone ?? '').toLowerCase()
    return name.includes(search.toLowerCase())
  })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">

      {/* Contagem */}
      <p className="text-sm" style={{ color: '#64748B' }}>
        {loading ? 'Carregando...' : `${convs.length} conversa${convs.length !== 1 ? 's' : ''}`}
      </p>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#CBD5E1' }} />
          <input
            className="input"
            style={{ paddingLeft: 40 }}
            placeholder="Buscar por nome ou número..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div
          className="flex gap-0.5 p-1 rounded-xl shrink-0"
          style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}
        >
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer whitespace-nowrap"
              style={{
                background: filter === f.value ? '#FFFFFF' : 'transparent',
                color:      filter === f.value ? '#0F172A' : '#94A3B8',
                boxShadow:  filter === f.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 p-4" style={{ borderTop: i > 1 ? '1px solid #F1F5F9' : 'none' }}>
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-32" />
                <div className="skeleton h-3 w-20" />
              </div>
              <div className="skeleton h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          <EmptyState
            icon={MessageSquare}
            title={search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}
            desc={search ? 'Tente outro termo de busca.' : 'As conversas do seu agente vão aparecer aqui.'}
          />
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          {filtered.map((conv, idx) => {
            const user  = conv.user as any
            const name  = user?.display_name ?? formatPhone(user?.phone) ?? conv.id.slice(0, 8)
            const level = conv.relationship_level ?? 0

            return (
              <div
                key={conv.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors cursor-default hover:bg-slate-50"
                style={{ borderTop: idx > 0 ? '1px solid #F1F5F9' : 'none' }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                  style={{ background: 'rgba(34,197,94,.1)', color: '#16a34a' }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>{name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {user?.phone && user?.display_name && (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{user.phone}</p>
                    )}
                    {conv.last_message_at && (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{timeAgo(conv.last_message_at)}</p>
                    )}
                  </div>
                </div>

                {/* Level + Status + Ação */}
                <div className="flex items-center gap-3 shrink-0">
                  {level > 0 && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-4 rounded-full"
                          style={{ background: i <= level ? '#22c55e' : '#E2E8F0' }}
                        />
                      ))}
                    </div>
                  )}
                  {conv.status === 'active' && <span className="badge badge-green">Ativa</span>}
                  {conv.status === 'paused' && <span className="badge badge-yellow">Atendimento humano</span>}
                  {conv.status === 'closed' && <span className="badge badge-gray">Fechada</span>}

                  {conv.status !== 'closed' && (
                    <button
                      onClick={e => { e.stopPropagation(); togglePause(conv) }}
                      disabled={togglingId === conv.id}
                      title={conv.status === 'paused' ? 'Devolver ao agente' : 'Assumir conversa'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                      style={conv.status === 'paused'
                        ? { background: 'rgba(34,197,94,.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,.2)' }
                        : { background: 'rgba(245,158,11,.1)', color: '#b45309', border: '1px solid rgba(245,158,11,.2)' }
                      }
                    >
                      {conv.status === 'paused'
                        ? <><Bot className="w-3.5 h-3.5" /> Devolver ao agente</>
                        : <><UserCheck className="w-3.5 h-3.5" /> Assumir</>
                      }
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: '#F1F5F9' }}
      >
        <Icon className="w-5 h-5" style={{ color: '#94A3B8' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{title}</p>
      <p className="text-xs mt-1 max-w-xs leading-relaxed" style={{ color: '#64748B' }}>{desc}</p>
    </div>
  )
}

function formatPhone(phone?: string): string | undefined {
  if (!phone) return undefined
  // LID do WhatsApp: número com mais de 13 dígitos — mostra como ID
  if (phone.length > 13) return `#${phone.slice(-8)}`
  // Número brasileiro: 55 + DDD (2) + número (8 ou 9)
  if (phone.startsWith('55') && phone.length >= 12) {
    const ddd = phone.slice(2, 4)
    const num = phone.slice(4)
    const formatted = num.length === 9
      ? `${num.slice(0, 5)}-${num.slice(5)}`
      : `${num.slice(0, 4)}-${num.slice(4)}`
    return `(${ddd}) ${formatted}`
  }
  return phone
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
