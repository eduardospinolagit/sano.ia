'use client'

import { useState }         from 'react'
import { useRouter }        from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding-store'
import { OnboardingShell }  from '../_components/onboarding-shell'
import { ChoiceCard }       from '../_components/choice-card'

export default function GoalPage() {
  const router   = useRouter()
  const setObjective = useOnboardingStore(s => s.setObjective)
  const stored       = useOnboardingStore(s => s.objective)
  const [selected, setSelected] = useState<'sales' | 'support'>(
    (stored === 'sales' || stored === 'support') ? stored : 'sales'
  )

  function choose(goal: 'sales' | 'support') {
    setSelected(goal)
    setObjective(goal)
    setTimeout(() => router.push('/onboarding/niche'), 300)
  }

  return (
    <OnboardingShell step={1}>
      <div className="space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            O que você quer que o agente faça por você?
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Isso define o foco principal do agente
          </p>
        </div>

        <div className="space-y-3">
          <ChoiceCard
            title="Responder clientes e não perder vendas"
            subtitle="Ideal para quem quer atender rápido e vender mais"
            selected={selected === 'sales'}
            recommended
            onClick={() => choose('sales')}
          />
          <ChoiceCard
            title="Organizar atendimento e suporte"
            subtitle="Ideal para responder dúvidas e melhorar o atendimento"
            selected={selected === 'support'}
            onClick={() => choose('support')}
          />
        </div>

      </div>
    </OnboardingShell>
  )
}
