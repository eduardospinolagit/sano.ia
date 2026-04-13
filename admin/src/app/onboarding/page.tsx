'use client'

import { useState }         from 'react'
import { useRouter }        from 'next/navigation'
import Image                from 'next/image'
import { Check, ArrowLeft, Zap, SlidersHorizontal } from 'lucide-react'
import { useOnboardingStore } from '@/store/onboarding-store'

// ─── Constantes ───────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'general',      label: 'Atendimento geral',  desc: 'Responde dúvidas e suporte ao cliente' },
  { value: 'scheduling',   label: 'Marcar reuniões',     desc: 'Agenda consultas, visitas ou demonstrações' },
  { value: 'quote',        label: 'Enviar orçamentos',   desc: 'Coleta informações e envia proposta comercial' },
  { value: 'lead_qualify', label: 'Qualificar leads',    desc: 'Filtra interesse e coleta dados para vendas' },
  { value: 'sales',        label: 'Venda direta',        desc: 'Conduz o cliente até o fechamento da compra' },
  { value: 'support',      label: 'Suporte técnico',     desc: 'Resolve problemas e dúvidas pós-venda' },
]

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_SHORT: Record<string, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
}

const STYLES = [
  { value: 'casual',   label: 'Casual',   desc: 'Natural e descontraído' },
  { value: 'formal',   label: 'Formal',   desc: 'Profissional e direto'  },
  { value: 'playful',  label: 'Animado',  desc: 'Leve e divertido'       },
  { value: 'intimate', label: 'Próximo',  desc: 'Caloroso e pessoal'     },
]

// ─── Page ────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const store  = useOnboardingStore()

  const [step,        setStep]        = useState(0)
  const [fading,      setFading]      = useState(false)
  const [horaCustom,  setHoraCustom]  = useState<'personalizado' | null>(null)
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd,   setCustomEnd]   = useState('18:00')

  function navigate(fn: () => void) {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 220)
  }

  const followupEnabled  = store.followUpEnabled
  const horariosStep     = followupEnabled ? 6 : 5
  const BASE_STEPS       = horariosStep
  const TOTAL_STEPS      = BASE_STEPS + (horaCustom === 'personalizado' ? 1 : 0)

  const stepId =
    step === 0                        ? 'welcome'        :
    step === 1                        ? 'nome'           :
    step === 2                        ? 'objetivo'       :
    step === 3                        ? 'tom'            :
    step === 4                        ? 'followup'       :
    followupEnabled && step === 5     ? 'followup_config':
    step === horariosStep             ? 'horarios'       :
    step === horariosStep + 1         ? 'horarios_custom':
    'welcome'

  const STEPS_META: Record<string, { label: string; desc: string }> = {
    nome:             { label: 'Nome do agente',         desc: 'Como seu agente vai se chamar para os clientes?' },
    objetivo:         { label: 'Objetivo',                desc: 'O que o agente vai fazer pelos seus clientes?' },
    tom:              { label: 'Tom de voz',              desc: 'Como o agente vai falar com as pessoas?' },
    followup:         { label: 'Follow-up',               desc: 'O agente deve contatar clientes que pararam de responder?' },
    followup_config:  { label: 'Configurar follow-up',    desc: 'Defina o intervalo e o número de tentativas.' },
    horarios:         { label: 'Horários',                desc: 'Em quais horários o agente vai responder?' },
    horarios_custom:  { label: 'Personalizar horários',   desc: 'Escolha os dias e o horário de atendimento.' },
  }

  const current = STEPS_META[stepId]
  const pct     = Math.round((step / TOTAL_STEPS) * 100)

  // Horários
  const hoursConfig = store.hoursConfig
  const activeDays  = DAYS.filter(d => hoursConfig[d]?.available)

  const HOUR_PRESETS = [
    { id: 'comercial',     label: 'Horário comercial',  desc: 'Segunda a sexta, das 8h às 18h',  days: ['monday','tuesday','wednesday','thursday','friday'], start: '08:00', end: '18:00' },
    { id: 'extended',      label: 'Horário estendido',  desc: 'Todos os dias, das 8h às 22h',    days: [...DAYS] as string[],                                start: '08:00', end: '22:00' },
    { id: '247',           label: '24 horas',           desc: 'Sem restrição de horário ou dia', days: [...DAYS] as string[],                                start: '00:00', end: '23:59' },
    { id: 'personalizado', label: 'Personalizado',      desc: 'Eu mesmo escolho os dias e o horário' },
  ]

  function applyHoursPreset(id: string) {
    if (id === 'personalizado') {
      setHoraCustom('personalizado')
      return
    }
    setHoraCustom(null)
    const preset = HOUR_PRESETS.find(p => p.id === id)!
    const newConfig: Record<string, any> = {}
    DAYS.forEach(d => {
      newConfig[d] = { available: (preset.days as string[]).includes(d), start: preset.start, end: preset.end }
    })
    store.setHoursConfig(newConfig)
  }

  const selectedPresetId = horaCustom === 'personalizado'
    ? 'personalizado'
    : HOUR_PRESETS.find(p =>
        p.id !== 'personalizado' &&
        (p.days as string[]).every(d => hoursConfig[d]?.available && hoursConfig[d]?.start === p.start && hoursConfig[d]?.end === p.end) &&
        DAYS.filter(d => !(p.days as string[]).includes(d)).every(d => !hoursConfig[d]?.available)
      )?.id ?? null

  function toggleCustomDay(day: string) {
    const cur = { ...store.hoursConfig }
    cur[day]  = { available: !cur[day]?.available, start: customStart, end: customEnd }
    store.setHoursConfig(cur)
  }

  function updateCustomTime(field: 'start' | 'end', value: string) {
    if (field === 'start') setCustomStart(value)
    else setCustomEnd(value)
    const cur = { ...store.hoursConfig }
    DAYS.forEach(d => { if (cur[d]?.available) cur[d] = { ...cur[d], [field]: value } })
    store.setHoursConfig(cur)
  }

  const canContinue =
    (stepId === 'nome'           && store.agentName.trim().length > 0) ||
    (stepId === 'horarios'       && selectedPresetId !== null)          ||
    (stepId === 'horarios_custom' && activeDays.length > 0)            ||
    !['nome', 'horarios', 'horarios_custom'].includes(stepId)

  function advance() {
    if (step < TOTAL_STEPS) {
      navigate(() => setStep(step + 1))
    } else {
      navigate(() => router.push('/onboarding/whatsapp'))
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-8" style={{ background: '#FAFAFA' }}>
      <div
        className={`w-full ${step === 0 ? 'max-w-xl space-y-8' : 'max-w-[360px] space-y-5'}`}
        style={{
          opacity:    fading ? 0 : 1,
          transform:  fading ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 200ms ease, transform 200ms ease',
        }}
      >

        {/* Logo (steps > 0) */}
        {step > 0 && (
          <div>
            <Image src="/logo.png" alt="Sano Lab" width={26} height={26} className="object-contain" />
          </div>
        )}

        {/* ── Tela de boas-vindas (step 0) ── */}
        {step === 0 && (
          <div className="min-h-screen flex flex-col items-center justify-center space-y-8 -mt-8">
            {/* Logo — mesma posição/tamanho do login */}
            <div className="flex flex-col items-center gap-5">
              <Image
                src="/logo.png"
                alt="Sano Lab"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
              <div className="space-y-1.5 text-center">
                <h1 className="font-heading text-xl font-semibold tracking-tight" style={{ color: '#0F172A' }}>
                  Vamos configurar seu agente
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
                  Escolha como quer configurar. Você pode ajustar tudo depois no painel.
                </p>
              </div>
            </div>

            {/* ── Seleção de modo ── */}
            <div className="grid grid-cols-2 gap-4 w-full">

              {/* Recomendada */}
              <button
                onClick={() => navigate(() => setStep(1))}
                className="text-left p-5 rounded-2xl transition-all duration-150 cursor-pointer flex flex-col"
                style={{
                  background: 'rgba(34,197,94,.04)',
                  border: '1.5px solid rgba(34,197,94,.25)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(34,197,94,.1)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
              >
                <div className="flex items-start gap-3 mb-4" style={{ minHeight: 56 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,.12)' }}>
                    <Zap className="w-4 h-4" style={{ color: '#16a34a' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Recomendada</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Configure tudo em 2 minutos</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-y-1.5 mt-auto">
                  {['Nome do agente', 'Objetivo principal', 'Tom de voz', 'Follow-up', 'Horários'].map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                      <Check className="w-3 h-3 shrink-0" style={{ color: '#22c55e' }} />
                      {item}
                    </span>
                  ))}
                </div>
              </button>

              {/* Avançada */}
              <button
                onClick={() => navigate(() => router.push('/agent'))}
                className="text-left p-5 rounded-2xl transition-all duration-150 cursor-pointer flex flex-col"
                style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #F1F5F9',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.border = '1.5px solid #CBD5E1'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(100,116,139,.06)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.border = '1.5px solid #F1F5F9'
                  ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                }}
              >
                <div className="flex items-start gap-3 mb-4" style={{ minHeight: 56 }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#F1F5F9' }}>
                    <SlidersHorizontal className="w-4 h-4" style={{ color: '#64748B' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Avançada</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Controle total sobre cada detalhe</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-y-1.5 mt-auto">
                  {['Identidade completa', 'Tom de voz', 'Base de conhecimento', 'Follow-up', 'Horários e períodos'].map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                      <Check className="w-3 h-3 shrink-0" style={{ color: '#94A3B8' }} />
                      {item}
                    </span>
                  ))}
                </div>
              </button>

            </div>
          </div>
        )}

        {/* Progress */}
        {step > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={() => navigate(() => setStep(step - 1))}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => navigate(() => setStep(0))}
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors cursor-pointer"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs" style={{ color: '#94A3B8' }}>Passo {step} de {TOTAL_STEPS}</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%`, background: '#22c55e' }}
              />
            </div>
          </div>
        )}

        {/* Heading + steps */}
        {step > 0 && (
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold" style={{ color: '#0F172A' }}>{current.label}</h2>
          <p className="text-sm" style={{ color: '#94A3B8' }}>{current.desc}</p>
        </div>
        )}

        {/* ── Nome ── */}
        {stepId === 'nome' && (
          <div className="space-y-3">
            <input
              className="input text-base"
              placeholder="Ex: Ana, Sano, Max..."
              value={store.agentName}
              onChange={e => store.setAgentName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canContinue && advance()}
              autoFocus
            />
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Este nome aparece para os clientes nas conversas pelo WhatsApp.
            </p>
          </div>
        )}

        {/* ── Objetivo ── */}
        {stepId === 'objetivo' && (
          <div className="grid grid-cols-2 gap-2.5">
            {OBJECTIVES.map(obj => {
              const active = store.objective === obj.value
              return (
                <button
                  key={obj.value}
                  onClick={() => store.setObjective(obj.value)}
                  className="text-left px-3.5 py-3 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border:     active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow:  active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{obj.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8', lineHeight: '1.4' }}>{obj.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Tom de voz ── */}
        {stepId === 'tom' && (
          <div className="grid grid-cols-2 gap-2.5">
            {STYLES.map(s => {
              const active = store.style === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => store.setStyle(s.value)}
                  className="text-left p-4 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border:     active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow:  active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{s.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Follow-up ── */}
        {stepId === 'followup' && (
          <div className="space-y-3">
            {[
              { value: true,  label: 'Sim, ativar follow-up',  desc: 'O agente contata clientes que pararam de responder' },
              { value: false, label: 'Não por enquanto',        desc: 'Só responde quando o cliente mandar mensagem' },
            ].map(opt => {
              const active = followupEnabled === opt.value
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => store.setFollowUpEnabled(opt.value)}
                  className="w-full text-left p-4 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border:     active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow:  active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{opt.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Follow-up config ── */}
        {stepId === 'followup_config' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: '#374151' }}>Aguardar antes do 1º follow-up</label>
              <select
                className="input"
                value={store.followupDelayHours}
                onChange={e => store.setFollowupDelayHours(parseInt(e.target.value))}
              >
                <option value={1}>1 hora</option>
                <option value={3}>3 horas</option>
                <option value={6}>6 horas</option>
                <option value={12}>12 horas</option>
                <option value={24}>1 dia</option>
                <option value={48}>2 dias</option>
                <option value={72}>3 dias</option>
                <option value={168}>1 semana</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" style={{ color: '#374151' }}>Máximo de tentativas</label>
              <select
                className="input"
                value={store.followupMaxAttempts}
                onChange={e => store.setFollowupMaxAttempts(parseInt(e.target.value))}
              >
                {[1,2,3,4,5].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'tentativa' : 'tentativas'}</option>
                ))}
              </select>
            </div>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Se o cliente responder a qualquer momento, o follow-up é cancelado automaticamente.
            </p>
          </div>
        )}

        {/* ── Horários ── */}
        {stepId === 'horarios' && (
          <div className="space-y-2.5">
            {HOUR_PRESETS.map(preset => {
              const active = selectedPresetId === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => applyHoursPreset(preset.id)}
                  className="w-full text-left px-3.5 py-3 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border:     active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow:  active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{preset.label}</p>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8', lineHeight: '1.4' }}>{preset.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Horários personalizados ── */}
        {stepId === 'horarios_custom' && (
          <div className="space-y-4">

            {/* Dias */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: '#64748B' }}>Dias de atendimento</p>
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map(day => {
                  const active = !!hoursConfig[day]?.available
                  return (
                    <button
                      key={day}
                      onClick={() => toggleCustomDay(day)}
                      className="py-2 rounded-lg text-xs font-medium transition-all duration-100 cursor-pointer"
                      style={{
                        background: active ? '#22c55e' : '#F1F5F9',
                        color:      active ? '#FFFFFF'  : '#64748B',
                      }}
                    >
                      {DAY_SHORT[day]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Horário */}
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: '#64748B' }}>Horário de atendimento</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Início</label>
                  <input
                    type="time"
                    className="input text-sm"
                    value={customStart}
                    onChange={e => updateCustomTime('start', e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs" style={{ color: '#94A3B8' }}>Fim</label>
                  <input
                    type="time"
                    className="input text-sm"
                    value={customEnd}
                    onChange={e => updateCustomTime('end', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {activeDays.length === 0 && (
              <p className="text-xs" style={{ color: '#94A3B8' }}>Selecione ao menos um dia.</p>
            )}

          </div>
        )}

        {/* ── Navegação ── */}
        {step > 0 && <div className="flex gap-3">
          <button
            onClick={advance}
            disabled={!canContinue}
            className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-40"
          >
            {step < TOTAL_STEPS ? 'Continuar' : 'Finalizar e conectar WhatsApp'}
          </button>
        </div>}

      </div>
    </div>
  )
}

