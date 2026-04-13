'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant }     from '@/hooks/use-tenant'
import { Check, CheckCircle2, Loader2, Plus, Trash2, BookOpen, Smartphone, Settings2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3002'
const S = { background: '#FFFFFF', border: '1px solid #E2E8F0' }

const TABS = ['Identidade', 'Objetivo', 'Comportamento', 'Conhecimento', 'Follow-up', 'Horários'] as const
type Tab = typeof TABS[number]

const OBJECTIVES = [
  { value: 'general',      label: 'Atendimento geral',  desc: 'Responde dúvidas e suporte ao cliente' },
  { value: 'scheduling',   label: 'Marcar reuniões',     desc: 'Agenda consultas, visitas ou demonstrações' },
  { value: 'quote',        label: 'Enviar orçamentos',   desc: 'Coleta informações e envia proposta comercial' },
  { value: 'lead_qualify', label: 'Qualificar leads',    desc: 'Filtra interesse e coleta dados para vendas' },
  { value: 'sales',        label: 'Venda direta',        desc: 'Conduz o cliente até o fechamento da compra' },
  { value: 'support',      label: 'Suporte técnico',     desc: 'Resolve problemas e dúvidas pós-venda' },
  { value: 'survey',       label: 'Pesquisa / feedback', desc: 'Coleta avaliações e opiniões dos clientes' },
]

const DEFAULT_STEPS: Record<string, string[]> = {
  scheduling:   ['Identificar interesse', 'Coletar dados de contato', 'Propor data/horário', 'Confirmar agendamento'],
  quote:        ['Entender necessidade', 'Coletar especificações', 'Informar prazo de orçamento', 'Enviar proposta', 'Aguardar retorno'],
  lead_qualify: ['Despertar interesse', 'Qualificar perfil', 'Coletar contato', 'Passar para vendas'],
  sales:        ['Apresentar produto', 'Tratar objeções', 'Fazer oferta', 'Fechar venda', 'Confirmar pedido'],
  support:      ['Identificar problema', 'Coletar dados técnicos', 'Propor solução', 'Confirmar resolução'],
  survey:       ['Apresentar pesquisa', 'Fazer perguntas', 'Agradecer participação'],
  general:      ['Saudação', 'Entender necessidade', 'Resolver dúvida', 'Encerrar atendimento'],
  custom:       [],
}

type Mode = 'recomendada' | 'avancada' | 'success' | null

const STYLES = [
  { value: 'casual',   label: 'Casual',   desc: 'Natural e descontraído' },
  { value: 'formal',   label: 'Formal',   desc: 'Profissional e direto'  },
  { value: 'playful',  label: 'Animado',  desc: 'Leve e divertido'       },
  { value: 'intimate', label: 'Próximo',  desc: 'Caloroso e pessoal'     },
]

const BASE_STEPS = 6 // sem follow-up; +1 se ativado

export default function AgentPage() {
  const { tenant, agent: initialAgent, waStatus } = useTenant()
  const supabase = createClient()
  const [mode,   setMode]   = useState<Mode>(null)
  const [step,   setStep]   = useState(1)
  const [tab,    setTab]    = useState<Tab>('Identidade')
  const [agent,  setAgent]  = useState(initialAgent)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  useEffect(() => {
    setAgent(initialAgent)
    // Se o agente já foi configurado, abre direto na tela de conclusão
    if (initialAgent?.objective && mode === null) {
      setMode('success')
    }
  }, [initialAgent])

  async function saveAgent() {
    if (!agent) return
    setSaving(true)
    try {
      await supabase.from('agents').update({
        name:                  agent.name,
        persona_prompt:        agent.persona_prompt ?? agent.persona,
        system_rules:          agent.system_rules   ?? agent.system_prompt,
        response_style:        agent.response_style,
        temperature:           agent.temperature,
        objective:             agent.objective,
        objective_meta:        agent.objective_meta,
        followup_enabled:      agent.followup_enabled,
        followup_delay_hours:  agent.followup_delay_hours,
        followup_messages:     agent.followup_messages,
        followup_max_attempts: agent.followup_max_attempts,
        active_hours_config:   agent.active_hours_config,
      }).eq('id', agent.id)
      try { await fetch(`${SERVER_URL}/tenants/${tenant?.id}/agent/reload`, { method: 'POST' }) } catch { /* servidor offline */ }
      setSaved(true)
      setTimeout(() => setSaved(false), 2_000)
    } finally { setSaving(false) }
  }

  if (!agent) return (
    <div className="flex-1 flex items-center justify-center h-full">
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#CBD5E1' }} />
    </div>
  )

  if (!mode) return (
    <div className="p-8 max-w-xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-xl font-semibold" style={{ color: '#0F172A' }}>Configurar agente</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Como você quer configurar o {agent.name}?</p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => { setMode('recomendada'); setStep(1) }}
          className="w-full text-left rounded-xl p-5 transition-all duration-150 cursor-pointer"
          style={{ background: '#FFFFFF', border: '1.5px solid #22c55e' }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34,197,94,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Configuração recomendada</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Ajuste os pontos principais em 2 minutos</p>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a' }}
            >
              Recomendado
            </span>
          </div>
        </button>

        <button
          onClick={() => setMode('avancada')}
          className="w-full text-left rounded-xl p-5 transition-all duration-150 cursor-pointer"
          style={{ background: '#FFFFFF', border: '1.5px solid #F1F5F9' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#CBD5E1')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#F1F5F9')}
        >
          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Configuração avançada</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Controle total: identidade, objetivo, comportamento, horários e mais</p>
        </button>
      </div>
    </div>
  )

  if (mode === 'success') return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-16 animate-fade-in" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Ícone de sucesso */}
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,.12)', border: '1.5px solid rgba(34,197,94,.25)' }}
          >
            <CheckCircle2 className="w-10 h-10" style={{ color: '#22c55e' }} />
          </div>
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-semibold" style={{ color: '#0F172A' }}>
            Agente configurado!
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
            O <strong style={{ color: '#0F172A' }}>{agent.name}</strong> está pronto.
            {waStatus !== 'connected'
              ? ' Conecte o WhatsApp para ele começar a responder.'
              : ' Ele já está ativo e recebendo mensagens.'}
          </p>
        </div>

        {/* Ações */}
        <div className="space-y-3">
          {waStatus !== 'connected' && (
            <Link
              href="/whatsapp"
              className="btn-primary w-full justify-center py-3 text-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Smartphone className="w-4 h-4" />
              Conectar WhatsApp
            </Link>
          )}

          <button
            onClick={() => setMode(null)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer"
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLElement).style.color = '#0F172A' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}
          >
            <Settings2 className="w-4 h-4" />
            Configurações do agente
          </button>
        </div>
      </div>
    </div>
  )

  if (mode === 'recomendada') return (
    <RecomendadaFlow
      agent={agent}
      setAgent={setAgent}
      step={step}
      setStep={setStep}
      onBack={() => setMode(null)}
      onFinish={async () => {
        await saveAgent()
        setTimeout(() => { setMode('success'); setStep(1) }, 1200)
      }}
      saving={saving}
      saved={saved}
    />
  )

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMode(null)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer"
            style={{ color: '#94A3B8' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F1F5F9'; (e.currentTarget as HTMLElement).style.color = '#64748B' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94A3B8' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-heading text-xl font-semibold" style={{ color: '#0F172A' }}>
              Configuração avançada
            </h1>
          </div>
        </div>
        <button
          onClick={async () => { await saveAgent(); setTimeout(() => setMode('success'), 1200) }}
          disabled={saving}
          className="btn-primary min-w-[100px] justify-center"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando</>
           : saved  ? <><Check className="w-4 h-4" /> Salvo</>
           : 'Salvar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0" style={{ borderBottom: '1.5px solid #E2E8F0' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150"
            style={{
              borderBottom: tab === t ? '2px solid #22c55e' : '2px solid transparent',
              color: tab === t ? '#22c55e' : '#64748B',
              marginBottom: '-1.5px',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Conteúdo das abas ── */}
      <div style={{ minHeight: 420 }}>
      {tab === 'Identidade' && (
        <div className="space-y-5 max-w-2xl">
          <Field label="Nome do agente">
            <input className="input" value={agent.name ?? ''} onChange={e => setAgent({ ...agent, name: e.target.value })} />
          </Field>

          <Field label="Tom de resposta">
            <select className="input" value={agent.response_style ?? 'casual'} onChange={e => setAgent({ ...agent, response_style: e.target.value })}>
              <option value="casual">Casual (natural e descontraído)</option>
              <option value="formal">Formal (profissional e direto)</option>
              <option value="playful">Animado (leve e divertido)</option>
              <option value="intimate">Próximo (caloroso e pessoal)</option>
            </select>
          </Field>

          <Field label="Persona" hint="Descreva quem é o agente e seu objetivo principal">
            <textarea
              className="input h-44 resize-y"
              placeholder="Você é [nome], assistente de [empresa]. Seu objetivo é..."
              value={agent.persona_prompt ?? ''}
              onChange={e => setAgent({ ...agent, persona_prompt: e.target.value })}
            />
          </Field>

          <Field label="Instruções adicionais" hint="Opcional: regras específicas de comportamento">
            <textarea
              className="input h-28 resize-y"
              placeholder="Nunca mencione concorrentes. Sempre peça o nome do cliente no início..."
              value={agent.system_rules ?? ''}
              onChange={e => setAgent({ ...agent, system_rules: e.target.value })}
            />
          </Field>
        </div>
      )}

      {tab === 'Objetivo' && <ObjectiveTab agent={agent} setAgent={setAgent} />}

      {/* ── Comportamento ── */}
      {tab === 'Comportamento' && (
        <div className="space-y-5 max-w-lg">
          <div className="rounded-xl p-5 space-y-4" style={S}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Criatividade das respostas</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Controla o quanto o agente varia nas respostas</p>
              </div>
              <span className="text-sm font-semibold tabular-nums" style={{ color: '#22c55e' }}>
                {(agent.temperature ?? 0.7).toFixed(2)}
              </span>
            </div>
            <input
              type="range" min="0.3" max="1.2" step="0.05"
              value={agent.temperature ?? 0.7}
              onChange={e => setAgent({ ...agent, temperature: parseFloat(e.target.value) })}
              className="w-full"
              style={{ accentColor: '#22c55e' }}
            />
            <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}>
              <span>Mais previsível</span>
              <span>Mais criativo</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'Conhecimento' && tenant && (
        <KnowledgeTab tenantId={tenant.id} supabase={supabase} />
      )}

      {tab === 'Follow-up' && <FollowUpTab agent={agent} setAgent={setAgent} />}

      {/* ── Horários ── */}
      {tab === 'Horários' && (
        <div className="max-w-lg space-y-4">
          <p className="text-sm" style={{ color: '#64748B' }}>
            Fora desses horários as mensagens são salvas e respondidas quando o agente retornar.
          </p>
          <HoursEditor
            value={agent.active_hours_config ?? {}}
            onChange={v => setAgent({ ...agent, active_hours_config: v })}
          />
        </div>
      )}

      </div>{/* fim min-height wrapper */}
    </div>
  )
}

// ─── Objetivo ────────────────────────────────────────────────

function ObjectiveTab({ agent, setAgent }: { agent: any; setAgent: (a: any) => void }) {
  const objective = agent.objective ?? 'general'
  const meta      = agent.objective_meta ?? {}
  const steps: string[] = meta.steps ?? DEFAULT_STEPS[objective] ?? []

  function selectObjective(value: string) {
    setAgent({ ...agent, objective: value, objective_meta: { ...meta, steps: DEFAULT_STEPS[value] ?? [] } })
  }
  function updateStep(i: number, v: string) {
    const s = [...steps]; s[i] = v
    setAgent({ ...agent, objective_meta: { ...meta, steps: s } })
  }
  function addStep() {
    setAgent({ ...agent, objective_meta: { ...meta, steps: [...steps, 'Nova etapa'] } })
  }
  function removeStep(i: number) {
    setAgent({ ...agent, objective_meta: { ...meta, steps: steps.filter((_, idx) => idx !== i) } })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-sm font-medium mb-3" style={{ color: '#0F172A' }}>Qual é o objetivo principal deste agente?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {OBJECTIVES.map(obj => {
            const active = objective === obj.value
            return (
              <button
                key={obj.value}
                onClick={() => selectObjective(obj.value)}
                className="text-left p-4 rounded-xl transition-all duration-150"
                style={{
                  background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                  border: active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #E2E8F0',
                  boxShadow: active ? '0 0 0 3px rgba(34,197,94,.08)' : '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>
                  {obj.label}
                </p>
                <p className="text-xs mt-0.5 leading-snug" style={{ color: '#64748B' }}>{obj.desc}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Funil */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Etapas do funil</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Sequência que o agente conduz o cliente</p>
          </div>
          <button onClick={addStep} className="btn-outline text-xs px-3 py-1.5">
            <Plus className="w-3 h-3" /> Etapa
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-sm italic" style={{ color: '#94A3B8' }}>
            Nenhuma etapa. Clique em "Etapa" para adicionar.
          </p>
        ) : (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(34,197,94,.1)', color: '#16a34a' }}
                >
                  {i + 1}
                </div>
                <input className="input flex-1" value={step} onChange={e => updateStep(i, e.target.value)} />
                <button
                  onClick={() => removeStep(i)}
                  className="p-1.5 rounded-lg transition-colors shrink-0"
                  style={{ color: '#94A3B8' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label="Mensagem de sucesso" hint="Enviada quando o objetivo for atingido (opcional)">
        <textarea
          className="input h-20 resize-y"
          placeholder="Ótimo! Seu agendamento foi confirmado. Até lá!"
          value={meta.success_message ?? ''}
          onChange={e => setAgent({ ...agent, objective_meta: { ...meta, success_message: e.target.value } })}
        />
      </Field>
    </div>
  )
}

// ─── Follow-up ───────────────────────────────────────────────

function FollowUpTab({ agent, setAgent }: { agent: any; setAgent: (a: any) => void }) {
  const enabled     = agent.followup_enabled      ?? false
  const delay       = agent.followup_delay_hours  ?? 24
  const maxAttempts = agent.followup_max_attempts ?? 3
  const messages: string[] = agent.followup_messages ?? []

  function addMessage() {
    setAgent({ ...agent, followup_messages: [...messages, ''] })
  }
  function updateMessage(i: number, v: string) {
    const u = [...messages]; u[i] = v; setAgent({ ...agent, followup_messages: u })
  }
  function removeMessage(i: number) {
    setAgent({ ...agent, followup_messages: messages.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Toggle */}
      <div className="rounded-xl p-5" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Ativar follow-up automático</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              O agente envia mensagens para clientes que pararam no meio do funil
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAgent({ ...agent, followup_enabled: !enabled })}
            style={{
              position: 'relative', width: 44, height: 24, borderRadius: 12,
              background: enabled ? '#22c55e' : '#E2E8F0', border: 'none',
              transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
              padding: 0, outline: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 4, left: enabled ? 24 : 4,
                width: 16, height: 16, borderRadius: '50%',
                background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Aguardar antes do 1º follow-up">
              <select className="input" value={delay} onChange={e => setAgent({ ...agent, followup_delay_hours: parseInt(e.target.value) })}>
                <option value={1}>1 hora</option>
                <option value={3}>3 horas</option>
                <option value={6}>6 horas</option>
                <option value={12}>12 horas</option>
                <option value={24}>1 dia</option>
                <option value={48}>2 dias</option>
                <option value={72}>3 dias</option>
                <option value={168}>1 semana</option>
              </select>
            </Field>
            <Field label="Máximo de tentativas">
              <select className="input" value={maxAttempts} onChange={e => setAgent({ ...agent, followup_max_attempts: parseInt(e.target.value) })}>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} {n === 1 ? 'tentativa' : 'tentativas'}</option>)}
              </select>
            </Field>
          </div>

          <div className="rounded-xl p-5 space-y-4" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Mensagens de reengajamento</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  Opcional: se não definir, a IA cria com base na conversa
                </p>
              </div>
              <button
                onClick={addMessage}
                disabled={messages.length >= maxAttempts}
                className="btn-outline text-xs px-3 py-1.5 disabled:opacity-40"
              >
                <Plus className="w-3 h-3" /> Mensagem
              </button>
            </div>

            {messages.length === 0 ? (
              <div
                className="rounded-lg p-4 space-y-1.5"
                style={{ background: 'rgba(34,197,94,.04)', border: '1px dashed rgba(34,197,94,.3)' }}
              >
                <p className="text-sm font-medium" style={{ color: '#16a34a' }}>Geração automática pela IA</p>
                <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                  O agente cria cada mensagem de follow-up com base no histórico da conversa com o lead, sem texto genérico, sempre contextualizado.
                </p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Quer controlar o texto? Clique em <strong style={{ color: '#0F172A' }}>Mensagem</strong> para definir manualmente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className="rounded-lg p-4 space-y-2.5" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium" style={{ color: '#64748B' }}>
                        {i + 1}ª mensagem após {i === 0 ? `${delay}h` : `${delay * (i + 1)}h`} sem resposta
                      </span>
                      <button
                        onClick={() => removeMessage(i)}
                        className="p-1 rounded transition-colors"
                        style={{ color: '#94A3B8' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      className="input h-20 resize-y"
                      placeholder={
                        i === 0 ? 'Oi {nome}! Notei que você ainda não finalizou. Posso te ajudar?'
                        : i === 1 ? 'Ei {nome}, ainda estou por aqui caso precise!'
                        : 'Passando para ver se ainda posso ser útil, {nome}!'
                      }
                      value={msg}
                      onChange={e => updateMessage(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Se o cliente responder em qualquer momento, o follow-up é cancelado automaticamente.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Conhecimento ─────────────────────────────────────────────

function KnowledgeTab({ tenantId, supabase }: { tenantId: string; supabase: any }) {
  const [entries,  setEntries]  = useState<any[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newBody,  setNewBody]  = useState('')
  const [adding,   setAdding]   = useState(false)

  useEffect(() => { load() }, [tenantId])

  async function load() {
    const { data } = await supabase
      .from('knowledge_entries').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: true })
    setEntries(data ?? [])
  }
  async function add() {
    if (!newTitle.trim() || !newBody.trim()) return
    setAdding(true)
    await supabase.from('knowledge_entries').insert({ tenant_id: tenantId, title: newTitle, content: newBody })
    setNewTitle(''); setNewBody(''); setAdding(false); load()
  }
  async function toggle(id: string, is_active: boolean) {
    await supabase.from('knowledge_entries').update({ is_active: !is_active }).eq('id', id); load()
  }
  async function remove(id: string) {
    await supabase.from('knowledge_entries').delete().eq('id', id); load()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm" style={{ color: '#64748B' }}>
        Informações que o agente usa para responder: horários, preços, produtos, FAQ, etc.
      </p>

      {entries.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F5F9' }}>
            <BookOpen className="w-5 h-5" style={{ color: '#94A3B8' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Nenhuma entrada ainda</p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>Adicione informações abaixo para o agente usar nas respostas</p>
        </div>
      )}

      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-xl p-4 transition-opacity"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', opacity: e.is_active ? 1 : 0.45 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{e.title}</p>
              <p className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{ color: '#64748B' }}>{e.content}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => toggle(e.id, e.is_active)} className="btn-outline text-xs px-2.5 py-1">
                {e.is_active ? 'Desativar' : 'Ativar'}
              </button>
              <button
                onClick={() => remove(e.id)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#94A3B8' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#DC2626'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#94A3B8'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Nova entrada */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Nova entrada</p>
        <input
          className="input"
          placeholder="Título (ex: Horário de funcionamento)"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
        />
        <textarea
          className="input h-24 resize-y"
          placeholder="Conteúdo que o agente vai usar nas respostas..."
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
        />
        <button
          onClick={add}
          disabled={adding || !newTitle.trim() || !newBody.trim()}
          className="btn-primary disabled:opacity-40"
        >
          {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adicionando</> : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}

// ─── Horários ─────────────────────────────────────────────────

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday:'Segunda', tuesday:'Terça', wednesday:'Quarta',
  thursday:'Quinta', friday:'Sexta', saturday:'Sábado', sunday:'Domingo',
}

function HoursEditor({ value, onChange }: { value: Record<string, any>; onChange: (v: any) => void }) {
  function toggle(day: string) {
    const on = value[day]?.available ?? false
    onChange({ ...value, [day]: { available: !on, start: value[day]?.start ?? '08:00', end: value[day]?.end ?? '22:00' } })
  }
  function setTime(day: string, field: 'start' | 'end', time: string) {
    onChange({ ...value, [day]: { ...value[day], [field]: time } })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      {DAYS.map((day, idx) => {
        const cfg = value[day] ?? {}
        const on  = cfg.available ?? false
        return (
          <div
            key={day}
            className="flex items-center gap-4 px-5 py-3.5"
            style={{ borderTop: idx > 0 ? '1px solid #F1F5F9' : 'none' }}
          >
            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggle(day)}
              style={{
                position: 'relative', width: 44, height: 24, borderRadius: 12,
                background: on ? '#22c55e' : '#E2E8F0', border: 'none',
                transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
                padding: 0, outline: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute', top: 4, left: on ? 24 : 4,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }}
              />
            </button>

            {/* Dia */}
            <span
              className="w-16 text-sm font-medium shrink-0 transition-colors duration-150"
              style={{ color: on ? '#0F172A' : '#CBD5E1' }}
            >
              {DAY_LABELS[day]}
            </span>

            {/* Horários */}
            {on ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={cfg.start ?? '08:00'}
                  onChange={e => setTime(day, 'start', e.target.value)}
                  className="input py-1.5 text-sm"
                  style={{ width: 110 }}
                />
                <span className="text-xs" style={{ color: '#94A3B8' }}>até</span>
                <input
                  type="time"
                  value={cfg.end ?? '22:00'}
                  onChange={e => setTime(day, 'end', e.target.value)}
                  className="input py-1.5 text-sm"
                  style={{ width: 110 }}
                />
              </div>
            ) : (
              <span className="text-xs" style={{ color: '#CBD5E1' }}>Inativo</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-sm font-medium" style={{ color: '#374151' }}>{label}</label>
        {hint && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Configuração Recomendada — Flow ─────────────────────────────────────────

function RecomendadaFlow({
  agent, setAgent, step, setStep, onBack, onFinish, saving, saved,
}: {
  agent: any; setAgent: (a: any) => void
  step: number; setStep: (s: number) => void
  onBack: () => void
  onFinish: () => void
  saving: boolean; saved: boolean
}) {
  const followupEnabled = agent.followup_enabled ?? false
  const TOTAL_STEPS = followupEnabled ? BASE_STEPS + 1 : BASE_STEPS

  // step 5 é sempre follow-up toggle
  // se followup_enabled: step 5.5 (=6) = config follow-up, horários = 6(7), finalizar = 7(8→6+1)
  // mapeamento: step 5 = follow-up, step 6 = config follow-up (se ativo), step 6/7 = horários, step 7/6 = finalizar
  const stepId =
    step === 1 ? 'nome'     :
    step === 2 ? 'objetivo' :
    step === 3 ? 'tom'      :
    step === 4 ? 'followup' :
    followupEnabled && step === 5 ? 'followup_config' :
    step === (followupEnabled ? 6 : 5) ? 'horarios' :
    'finalizar'

  const STEPS_META: Record<string, { label: string; desc: string }> = {
    nome:            { label: 'Nome do agente', desc: 'Como seu agente vai se chamar para os clientes?' },
    objetivo:        { label: 'Objetivo',        desc: 'O que o agente vai fazer pelos seus clientes?' },
    tom:             { label: 'Tom de voz',      desc: 'Como o agente vai falar com as pessoas?' },
    followup:        { label: 'Follow-up',       desc: 'O agente deve contatar clientes que pararam de responder?' },
    followup_config: { label: 'Configurar follow-up', desc: 'Defina o intervalo e o número de tentativas.' },
    horarios:        { label: 'Horários',        desc: 'Em quais horários o agente vai responder?' },
    finalizar:       { label: 'Finalizar',       desc: 'Tudo certo! Revise e salve.' },
  }

  const current = STEPS_META[stepId]

  const pct = Math.round((step / TOTAL_STEPS) * 100)

  // Resumo dos dias ativos para o review
  const hoursConfig = agent.active_hours_config ?? {}
  const activeDays = DAYS.filter(d => hoursConfig[d]?.available)
  const hoursLabel = activeDays.length === 0
    ? 'Nenhum horário definido'
    : activeDays.length === 7
      ? '24/7 — todos os dias'
      : `${activeDays.length} dia${activeDays.length > 1 ? 's' : ''} configurado${activeDays.length > 1 ? 's' : ''}`

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-10 animate-fade-in" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-lg space-y-8">

        {/* Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-xs cursor-pointer transition-opacity hover:opacity-60" style={{ color: '#94A3B8' }}>
              ← Voltar
            </button>
            <span className="text-xs" style={{ color: '#94A3B8' }}>Passo {step} de {TOTAL_STEPS}</span>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%`, background: '#22c55e' }}
            />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-semibold" style={{ color: '#0F172A' }}>{current.label}</h2>
          <p className="text-sm" style={{ color: '#94A3B8' }}>{current.desc}</p>
        </div>

        {/* Nome */}
        {stepId === 'nome' && (
          <div className="space-y-3">
            <input
              className="input text-base"
              placeholder="Ex: Ana, Sano, Max..."
              value={agent.name ?? ''}
              onChange={e => setAgent({ ...agent, name: e.target.value })}
              autoFocus
            />
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Este nome aparece para os clientes nas conversas pelo WhatsApp.
            </p>
          </div>
        )}

        {/* Objetivo */}
        {stepId === 'objetivo' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {OBJECTIVES.map(obj => {
              const active = (agent.objective ?? 'general') === obj.value
              return (
                <button
                  key={obj.value}
                  onClick={() => setAgent({ ...agent, objective: obj.value })}
                  className="text-left p-4 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border: active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow: active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{obj.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{obj.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Tom de voz */}
        {stepId === 'tom' && (
          <div className="grid grid-cols-2 gap-2.5">
            {STYLES.map(s => {
              const active = (agent.response_style ?? 'casual') === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => setAgent({ ...agent, response_style: s.value })}
                  className="text-left p-4 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border: active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow: active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{s.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Follow-up — sim/não */}
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
                  onClick={() => setAgent({ ...agent, followup_enabled: opt.value })}
                  className="w-full text-left p-4 rounded-xl transition-all duration-150 cursor-pointer"
                  style={{
                    background: active ? 'rgba(34,197,94,.06)' : '#FFFFFF',
                    border: active ? '1.5px solid rgba(34,197,94,.4)' : '1.5px solid #F1F5F9',
                    boxShadow: active ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: active ? '#16a34a' : '#0F172A' }}>{opt.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{opt.desc}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* Follow-up — configuração */}
        {stepId === 'followup_config' && (
          <div className="space-y-4">
            <Field label="Aguardar antes do 1º follow-up">
              <select
                className="input"
                value={agent.followup_delay_hours ?? 24}
                onChange={e => setAgent({ ...agent, followup_delay_hours: parseInt(e.target.value) })}
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
            </Field>
            <Field label="Máximo de tentativas">
              <select
                className="input"
                value={agent.followup_max_attempts ?? 3}
                onChange={e => setAgent({ ...agent, followup_max_attempts: parseInt(e.target.value) })}
              >
                {[1,2,3,4,5].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'tentativa' : 'tentativas'}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              Se o cliente responder em qualquer momento, o follow-up é cancelado automaticamente.
            </p>
          </div>
        )}

        {/* Horários */}
        {stepId === 'horarios' && (
          <SimpleHoursEditor
            value={agent.active_hours_config ?? {}}
            onChange={v => setAgent({ ...agent, active_hours_config: v })}
          />
        )}

        {/* Finalizar */}
        {stepId === 'finalizar' && (
          <div className="rounded-xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid #F1F5F9' }}>
            {[
              { label: 'Nome',       value: agent.name || '—' },
              { label: 'Objetivo',   value: OBJECTIVES.find(o => o.value === agent.objective)?.label ?? '—' },
              { label: 'Tom de voz', value: STYLES.find(s => s.value === agent.response_style)?.label ?? '—' },
              { label: 'Follow-up',  value: followupEnabled ? `Ativado · ${agent.followup_delay_hours ?? 24}h · ${agent.followup_max_attempts ?? 3}x` : 'Desativado', color: followupEnabled ? '#16a34a' : '#94A3B8' },
              { label: 'Horários',   value: hoursLabel },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderTop: i > 0 ? '1px solid #F8FAFC' : 'none' }}
              >
                <span className="text-sm" style={{ color: '#94A3B8' }}>{row.label}</span>
                <span className="text-sm font-medium" style={{ color: row.color ?? '#0F172A' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Navegação */}
        <div className="flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="btn-outline flex-1 justify-center py-2.5">
              Voltar
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={
                (stepId === 'nome' && !(agent.name ?? '').trim()) ||
                (stepId === 'horarios' && activeDays.length === 0)
              }
              className="btn-primary flex-1 justify-center py-2.5 disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button onClick={onFinish} disabled={saving} className="btn-primary flex-1 justify-center py-2.5">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando</>
                : saved ? <><Check className="w-4 h-4" /> Salvo!</>
                : 'Salvar configuração'
              }
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── SimpleHoursEditor (fluxo recomendado) ───────────────────────────────────

const DAY_SHORT: Record<string, string> = {
  monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua',
  thursday: 'Qui', friday: 'Sex', saturday: 'Sáb', sunday: 'Dom',
}

function SimpleHoursEditor({ value, onChange }: { value: Record<string, any>; onChange: (v: any) => void }) {
  const [start, setStart] = useState('08:00')
  const [end,   setEnd]   = useState('18:00')

  const activeDays = DAYS.filter(d => value[d]?.available)
  const is247 = activeDays.length === 7 &&
    DAYS.every(d => value[d]?.start === '00:00' && value[d]?.end === '23:59')

  function toggleDay(day: string) {
    const on = value[day]?.available ?? false
    onChange({ ...value, [day]: { available: !on, start, end } })
  }

  function applyTime(field: 'start' | 'end', time: string) {
    if (field === 'start') setStart(time)
    else setEnd(time)
    const s = field === 'start' ? time : start
    const e = field === 'end'   ? time : end
    const updated = { ...value }
    DAYS.forEach(d => { if (updated[d]?.available) updated[d] = { ...updated[d], [field]: field === 'start' ? s : e } })
    onChange(updated)
  }

  function toggle247() {
    if (is247) {
      onChange(Object.fromEntries(DAYS.map(d => [d, { available: false, start, end }])))
    } else {
      onChange(Object.fromEntries(DAYS.map(d => [d, { available: true, start: '00:00', end: '23:59' }])))
    }
  }

  return (
    <div className="space-y-5">

      {/* Botão 24/7 */}
      <button
        onClick={toggle247}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-150 cursor-pointer"
        style={{
          background: is247 ? 'rgba(34,197,94,.06)' : '#FFFFFF',
          border:     is247 ? '1.5px solid rgba(34,197,94,.35)' : '1.5px solid #E2E8F0',
          boxShadow:  is247 ? '0 0 0 3px rgba(34,197,94,.08)' : 'none',
        }}
      >
        <div className="text-left">
          <p className="text-sm font-medium" style={{ color: is247 ? '#16a34a' : '#0F172A' }}>
            Sempre disponível — 24/7
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Responde a qualquer hora, todos os dias</p>
        </div>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{ background: is247 ? '#22c55e' : '#E2E8F0' }}
        >
          {is247 && <Check className="w-3 h-3" style={{ color: '#fff' }} />}
        </div>
      </button>

      {/* Divisor */}
      {!is247 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: '#F1F5F9' }} />
          <span className="text-xs" style={{ color: '#CBD5E1' }}>ou escolha os dias</span>
          <div className="flex-1 h-px" style={{ background: '#F1F5F9' }} />
        </div>
      )}

      {/* Dias — chips */}
      {!is247 && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {DAYS.map(day => {
              const on = value[day]?.available ?? false
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className="w-10 h-10 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer"
                  style={{
                    background: on ? '#22c55e' : '#F1F5F9',
                    color:      on ? '#FFFFFF' : '#94A3B8',
                    boxShadow:  on ? '0 2px 8px rgba(34,197,94,.25)' : 'none',
                  }}
                >
                  {DAY_SHORT[day]}
                </button>
              )
            })}
          </div>

          {/* Horário — só aparece quando há dias ativos */}
          {activeDays.length > 0 && (
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={start}
                onChange={e => applyTime('start', e.target.value)}
                className="input py-2 text-sm"
                style={{ width: 120 }}
              />
              <span className="text-xs" style={{ color: '#94A3B8' }}>até</span>
              <input
                type="time"
                value={end}
                onChange={e => applyTime('end', e.target.value)}
                className="input py-2 text-sm"
                style={{ width: 120 }}
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
