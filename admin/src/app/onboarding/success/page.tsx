'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { useOnboardingStore }  from '@/store/onboarding-store'

const CHAT: { from: 'client' | 'agent'; text: string; delay: number }[] = [
  { from: 'client', text: 'Oi, vocês fazem orçamento?',                        delay: 700  },
  { from: 'agent',  text: 'oi! faço sim 😊 pode me dizer o que você precisa?', delay: 1_600 },
]

export default function SuccessPage() {
  const router = useRouter()
  const reset  = useOnboardingStore(s => s.reset)
  const [visible, setVisible] = useState<number[]>([])

  useEffect(() => {
    CHAT.forEach((msg, i) => {
      setTimeout(() => setVisible(prev => [...prev, i]), msg.delay)
    })
  }, [])

  function go(path: string) {
    reset()
    router.push(path)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: '#F8FAFC' }}
    >
      <div className="w-full max-w-lg space-y-8 animate-fade-up">

        {/* Heading */}
        <div className="text-center space-y-1.5">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Seu agente já está ativo 🚀
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
            Ele já está pronto para responder seus clientes automaticamente
          </p>
        </div>

        {/* Chat simulation */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}
        >
          <p className="text-xs font-medium mb-4" style={{ color: '#94A3B8' }}>
            Prévia do agente em ação
          </p>

          {CHAT.map((msg, i) => (
            <div
              key={i}
              className="flex transition-all duration-500"
              style={{
                justifyContent: msg.from === 'agent' ? 'flex-end' : 'flex-start',
                opacity:        visible.includes(i) ? 1 : 0,
                transform:      visible.includes(i) ? 'translateY(0)' : 'translateY(6px)',
              }}
            >
              <div
                className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                style={
                  msg.from === 'agent'
                    ? { background: '#22c55e', color: '#FFFFFF', borderBottomRightRadius: '4px' }
                    : { background: '#F1F5F9', color: '#0F172A', borderBottomLeftRadius:  '4px' }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => go('/conversations')}
            className="btn-primary w-full justify-center py-3.5 text-base"
          >
            Ver conversas
          </button>
          <button
            type="button"
            onClick={() => go('/dashboard')}
            className="btn-outline w-full justify-center py-3.5 text-base"
          >
            Ir para o dashboard
          </button>
        </div>

      </div>
    </div>
  )
}
