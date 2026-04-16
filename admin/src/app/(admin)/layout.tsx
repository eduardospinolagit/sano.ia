'use client'

import Image      from 'next/image'
import Link       from 'next/link'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant }    from '@/hooks/use-tenant'
import {
  LayoutDashboard, MessageSquare, Bot,
  Smartphone, Settings, LogOut,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversas',        icon: MessageSquare   },
  { href: '/agent',         label: 'Agente',           icon: Bot             },
  { href: '/whatsapp',      label: 'WhatsApp',         icon: Smartphone      },
  { href: '/settings',      label: 'Configurações',    icon: Settings        },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const { tenant, waStatus, loading, isAuthenticated } = useTenant()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace('/login')
    } else if (!tenant) {
      router.replace('/onboarding')
    }
  }, [loading, isAuthenticated, tenant])

  async function handleLogout() {
    sessionStorage.removeItem('sano_tenant_cache')
    await supabase.auth.signOut()
    router.push('/login')
  }

  const waDot =
    waStatus === 'connected'  ? '#22c55e' :
    waStatus === 'qr_pending' ? '#F59E0B' :
    waStatus === 'connecting' ? '#3B82F6' : '#CBD5E1'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>

      {/* ── Sidebar ── */}
      <aside
        className="w-52 flex-shrink-0 flex flex-col"
        style={{
          background:   '#FFFFFF',
          borderRight:  '1px solid #F1F5F9',
        }}
      >
        {/* Logo */}
        <div className="flex justify-center py-5">
          <Image
            src="/logo.png"
            alt="Sano Lab"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#F1F5F9', margin: '0 20px' }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100"
                style={{
                  color:      active ? '#0F172A'  : '#94A3B8',
                  background: active ? '#F8FAFC'  : 'transparent',
                  fontWeight: active ? 500        : 400,
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = '#64748B'
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = '#94A3B8'
                }}
              >
                <Icon
                  className="w-4 h-4 shrink-0"
                  style={{ color: active ? '#22c55e' : 'inherit' }}
                />
                <span className="flex-1">{label}</span>

                {href === '/whatsapp' && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: waDot }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5">
          <div style={{ height: 1, background: '#F1F5F9', marginBottom: 12 }} />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors duration-100 cursor-pointer"
            style={{ color: '#CBD5E1' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#EF4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#CBD5E1'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: '#F8FAFC' }}>

        {/* Topbar fixa com o nome da página */}
        {!loading && (() => {
          const current = NAV.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))
          if (!current) return null
          return (
            <div
              className="shrink-0 px-8 pt-7 pb-4"
              style={{ borderBottom: '1px solid #F1F5F9' }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#CBD5E1' }}>
                {current.label}
              </p>
            </div>
          )
        })()}

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-auto" style={{ scrollbarGutter: 'stable' }}>
          {loading ? null : children}
        </div>

      </main>
    </div>
  )
}
