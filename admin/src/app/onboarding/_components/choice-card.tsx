'use client'

import { Check } from 'lucide-react'

interface ChoiceCardProps {
  title:        string
  subtitle?:    string
  selected:     boolean
  recommended?: boolean
  onClick:      () => void
  children?:    React.ReactNode
}

export function ChoiceCard({
  title, subtitle, selected, recommended, onClick, children,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl p-5 transition-all duration-200 focus:outline-none cursor-pointer"
      style={{
        background:  selected ? 'rgba(34,197,94,.05)' : '#FFFFFF',
        border:      selected ? '2px solid #22c55e'   : '2px solid #E2E8F0',
        boxShadow:   selected ? '0 0 0 4px rgba(34,197,94,.08)' : '0 1px 3px rgba(0,0,0,0.05)',
        transform:   selected ? 'scale(1.005)'        : 'scale(1)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading font-semibold text-base" style={{ color: '#0F172A' }}>
              {title}
            </span>
            {recommended && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(34,197,94,.1)', color: '#16a34a' }}
              >
                recomendado
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>
              {subtitle}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>

        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200"
          style={{
            background: selected ? '#22c55e'            : 'transparent',
            border:     selected ? '2px solid #22c55e'  : '2px solid #CBD5E1',
          }}
        >
          {selected && <Check className="w-3.5 h-3.5" style={{ color: '#FFFFFF' }} />}
        </div>
      </div>
    </button>
  )
}
