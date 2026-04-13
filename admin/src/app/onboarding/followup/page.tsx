'use client'

import { useState }           from 'react'
import { useRouter }          from 'next/navigation'
import { useOnboardingStore } from '@/store/onboarding-store'
import { OnboardingShell }    from '../_components/onboarding-shell'
import { ChoiceCard }         from '../_components/choice-card'

export default function FollowUpPage() {
  const router            = useRouter()
  const setFollowUp       = useOnboardingStore(s => s.setFollowUpEnabled)
  const stored            = useOnboardingStore(s => s.followUpEnabled)
  const [selected, setSelected] = useState<boolean>(stored)

  function choose(v: boolean) {
    setSelected(v)
    setFollowUp(v)
    setTimeout(() => router.push('/onboarding/products'), 300)
  }

  return (
    <OnboardingShell step={3}>
      <div className="space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Quer que o agente volte a falar com o cliente se ele parar de responder?
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>
            Você pode ajustar o tempo de espera depois
          </p>
        </div>

        <div className="space-y-3">
          <ChoiceCard
            title="Sim, insistir automaticamente"
            subtitle="O agente manda mensagens se o cliente sumir. Ideal para não perder oportunidades."
            selected={selected === true}
            recommended
            onClick={() => choose(true)}
          />
          <ChoiceCard
            title="Não, só responder quando chamarem"
            subtitle="Sem mensagens automáticas. O agente só responde quando o cliente escrever."
            selected={selected === false}
            onClick={() => choose(false)}
          />
        </div>

      </div>
    </OnboardingShell>
  )
}
