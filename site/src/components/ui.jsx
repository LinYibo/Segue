const EXTERNAL = /^https?:/

export function LinkButton({ href, variant = 'primary', className = '', children }) {
  const styles =
    variant === 'primary'
      ? 'bg-primary text-primary-fg hover:opacity-85'
      : 'border border-border bg-surface text-fg hover:border-border-strong'
  const external = EXTERNAL.test(href)
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-all ${styles} ${className}`}
    >
      {children}
    </a>
  )
}

export function SectionHead({ title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm leading-6 text-muted">{subtitle}</p> : null}
    </div>
  )
}
