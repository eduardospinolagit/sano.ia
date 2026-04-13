'use client'

import { useState }           from 'react'
import { useRouter }          from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding-store'
import { OnboardingShell }    from '../_components/onboarding-shell'
import { ChoiceCard }         from '../_components/choice-card'

export default function ProductsPage() {
  const router      = useRouter()
  const setProducts = useOnboardingStore(s => s.setProducts)
  const stored      = useOnboardingStore(s => s.products)

  const [addNow, setAddNow]   = useState(false)
  const [text,   setText]     = useState(stored)

  function skip() {
    router.push('/onboarding/whatsapp')
  }

  function confirmProducts() {
    setProducts(text.trim())
    router.push('/onboarding/whatsapp')
  }

  function chooseAdd() {
    setAddNow(true)
  }

  function chooseSkip() {
    setAddNow(false)
    setProducts('')
    setTimeout(() => skip(), 300)
  }

  return (
    <OnboardingShell step={4}>
      <div className="space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Quer adicionar seus produtos ou serviços agora?
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Isso ajuda o agente a falar com mais precisão sobre o que você oferece
          </p>
        </div>

        <div className="space-y-3">
          <ChoiceCard
            title="Sim, adicionar agora"
            subtitle="O agente vai usar essas informações nas respostas"
            selected={addNow}
            onClick={chooseAdd}
          />
          <ChoiceCard
            title="Pular por enquanto"
            subtitle="Você pode adicionar depois em Configurações → Conhecimento"
            selected={!addNow}
            recommended
            onClick={chooseSkip}
          />
        </div>

        {/* Textarea condicional */}
        {addNow && (
          <div className="space-y-3 animate-fade-up">
            <textarea
              className="input min-h-[120px]"
              placeholder="Ex: limpeza de pele R$ 120, consultoria 1h R$ 300, site profissional a partir de R$ 1.500..."
              value={text}
              onChange={e => setText(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={confirmProducts}
              disabled={!text.trim()}
              className="btn-primary w-full justify-center py-3 text-base disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        )}

      </div>
    </OnboardingShell>
  )
}
