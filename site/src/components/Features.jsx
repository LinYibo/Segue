import { useI18n } from '../i18n/index.jsx'
import { SITE } from '../config.js'
import { IconArrowRight, IconBookOpen, IconQuote, IconShield, IconSliders } from './icons.jsx'
import { LinkButton, SectionHead } from './ui.jsx'

const ICONS = [IconBookOpen, IconQuote, IconShield, IconSliders]

export function Features() {
  const { t } = useI18n()
  const items = t('features.items')

  return (
    <section id="features" className="border-t border-border/70 py-16">
      <div className="mx-auto max-w-5xl px-5">
        <SectionHead title={t('features.title')} subtitle={t('features.subtitle')} />

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length]
            return (
              <div key={item.title} className="rounded-xl border border-border bg-surface/60 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-bg text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            )
          })}
        </div>

        {/* The web demo strip: what /app.html is, and how it differs from the desktop app. */}
        <div className="mt-10 flex flex-col items-start gap-4 rounded-xl border border-border bg-paper p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight">{t('features.webTitle')}</h3>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{t('features.webBody')}</p>
          </div>
          <LinkButton href={SITE.appUrl} className="shrink-0">
            {t('nav.try')}
            <IconArrowRight />
          </LinkButton>
        </div>
      </div>
    </section>
  )
}
