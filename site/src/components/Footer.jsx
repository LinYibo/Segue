import logo from '../assets/logo.svg'
import { SITE } from '../config.js'
import { useI18n } from '../i18n/index.jsx'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-5 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-8 w-8 rounded-lg" />
          <div>
            <p className="text-sm font-semibold">Segue</p>
            <p className="text-xs text-subtle">{SITE.domain}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-xs text-subtle sm:items-end">
          <div className="flex items-center gap-4">
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-fg"
            >
              {t('footer.github')}
            </a>
            <a
              href={SITE.releases}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-fg"
            >
              {t('footer.releases')}
            </a>
            <a href={SITE.appUrl} className="transition-colors hover:text-fg">
              {t('nav.try')}
            </a>
          </div>
          <p>{t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
