'use client'

interface ProgressBarProps {
  step:  number
  total: number
}

export function ProgressBar({ step, total }: ProgressBarProps) {
  const pct = Math.round((step / total) * 100)

  return (
    <div className="w-full space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
          Passo {step} de {total}
        </span>
        <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
          {pct}%
        </span>
      </div>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: '#E2E8F0' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%`, background: '#22c55e' }}
        />
      </div>
    </div>
  )
}
