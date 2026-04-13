'use client'

import { Zap } from 'lucide-react'
import { ProgressBar } from './progress-bar'

interface OnboardingShellProps {
  step?:    number
  total?:   number
  children: React.ReactNode
}

export function OnboardingShell({ step, total = 5, children }: OnboardingShellProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: '#F8FAFC' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: '#22c55e', boxShadow: '0 2px 8px rgba(34,197,94,.3)' }}
        >
          <Zap className="w-4 h-4" style={{ color: '#FFFFFF' }} />
        </div>
        <span className="font-heading text-base font-semibold" style={{ color: '#0F172A' }}>
          Sano<span style={{ color: '#22c55e' }}>.ia</span>
        </span>
      </div>

      {/* Progress */}
      {step !== undefined && (
        <div className="w-full max-w-lg mb-8">
          <ProgressBar step={step} total={total} />
        </div>
      )}

      {/* Content */}
      <div className="w-full max-w-lg animate-fade-up">
        {children}
      </div>
    </div>
  )
}
