'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email ou senha incorretos.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5"
      style={{ background: '#FAFAFA' }}
    >
      <div className="w-full max-w-[360px] space-y-8">

        {/* Logo + Header */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="Sano Lab"
            width={40}
            height={40}
            className="object-contain"
            priority
          />
          <div className="text-center space-y-1">
            <h1 className="font-heading text-xl font-semibold tracking-tight" style={{ color: '#0F172A' }}>
              Bem-vindo
            </h1>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Acesse sua conta para acompanhar seu agente Sano
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium" style={{ color: '#374151' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="seu@email.com"
              value={email}
              autoComplete="email"
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium" style={{ color: '#374151' }}>
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input pr-11"
                placeholder="••••••••"
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors cursor-pointer"
                style={{ color: '#94A3B8' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#64748B')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5 mt-1"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando</>
              : 'Entrar'
            }
          </button>

        </form>

      </div>

      {/* Botão de suporte flutuante */}
      <a
        href="https://wa.me/5547974007753?text=Ol%C3%A1%2C+preciso+de+ajuda+para+acessar+a+plataforma+Sano.ia"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-opacity duration-150 cursor-pointer"
        style={{
          background: '#FFFFFF',
          border:     '1px solid #E2E8F0',
          color:      '#94A3B8',
          boxShadow:  '0 1px 6px rgba(0,0,0,0.06)',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.7')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.562 4.14 1.54 5.877L0 24l6.322-1.519A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.366l-.36-.214-3.732.897.936-3.618-.235-.372A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
        </svg>
        Suporte
      </a>
    </div>
  )
}
