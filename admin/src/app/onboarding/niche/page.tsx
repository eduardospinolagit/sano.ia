'use client'

import { useState }           from 'react'
import { useRouter }          from 'next/navigation'
import { ArrowRight }         from 'lucide-react'
import { useOnboardingStore } from '@/store/onboarding-store'
import { OnboardingShell }    from '../_components/onboarding-shell'

const SUGGESTIONS = ['Clínica', 'Academia', 'Restaurante', 'Loja', 'Consultoria', 'Outro']

export default function NichePage() {
  const router   = useRouter()
  const setNiche = useOnboardingStore(s => s.setNiche)
  const stored   = useOnboardingStore(s => s.niche)
  const [value, setValue] = useState(stored)

  function advance(niche: string) {
    if (!niche.trim()) return
    setNiche(niche.trim())
    router.push('/onboarding/followup')
  }

  function pickSuggestion(s: string) {
    setValue(s)
    setNiche(s)
    setTimeout(() => router.push('/onboarding/followup'), 300)
  }

  return (
    <OnboardingShell step={2}>
      <div className="space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Qual é o seu tipo de negócio?
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            O agente vai se adaptar para o seu mercado
          </p>
        </div>

        <div className="space-y-4">
          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 focus:outline-none cursor-pointer"
                style={{
                  background: value === s ? 'rgba(34,197,94,.08)' : '#FFFFFF',
                  border:     value === s ? '1.5px solid #22c55e' : '1.5px solid #E2E8F0',
                  color:      value === s ? '#16a34a'             : '#374151',
                  boxShadow:  value === s ? '0 0 0 3px rgba(34,197,94,.1)' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Free text */}
          <div className="relative">
            <input
              type="text"
              className="input pr-12"
              placeholder="Ou descreva o seu negócio..."
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && advance(value)}
              autoFocus={!value}
            />
            {value.trim() && (
              <button
                type="button"
                onClick={() => advance(value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80 cursor-pointer"
                style={{ background: '#22c55e' }}
              >
                <ArrowRight className="w-4 h-4" style={{ color: '#FFFFFF' }} />
              </button>
            )}
          </div>

          {value.trim() && !SUGGESTIONS.includes(value) && (
            <button
              type="button"
              onClick={() => advance(value)}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              Continuar
            </button>
          )}
        </div>

      </div>
    </OnboardingShell>
  )
}
