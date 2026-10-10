import { useI18n } from '../i18n/index.jsx'

const OPTIONS = [
  { id: 'en', label: 'EN' },
  { id: 'zh', label: '中文' },
]

export function LangToggle({ className = '' }) {
  const { lang, setLang, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t('nav.language')}
      className={`inline-flex rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      {OPTIONS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setLang(id)}
          aria-pressed={lang === id}
          className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
            lang === id ? 'bg-elevated text-fg' : 'text-subtle hover:text-fg'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
