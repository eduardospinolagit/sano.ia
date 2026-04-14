interface PageHeaderProps {
  title:    string
  subtitle?: string
  right?:   React.ReactNode
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#CBD5E1' }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-sm" style={{ color: '#64748B' }}>{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
