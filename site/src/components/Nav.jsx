import logo from '../assets/logo.svg'
import { SITE } from '../config.js'
import { useI18n } from '../i18n/index.jsx'
import { IconGithub } from './icons.jsx'
import { LangToggle } from './LangToggle.jsx'

const LINKS = [{ href: '#features', key: 'nav.features' }]

export function Nav() {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={logo} alt="" className="h-7 w-7 rounded-[0.45rem]" />
          <span className="text-sm font-semibold tracking-tight">Segue</span>
        </a>

        <nav className="ml-auto hidden items-center gap-6 text-sm text-muted md:flex">
          {LINKS.map(({ href, key }) => (
            <a key={href} href={href} className="transition-colors hover:text-fg">
              {t(key)}
            </a>
          ))}
          <a href={SITE.appUrl} className="transition-colors hover:text-fg">
            {t('nav.try')}
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LangToggle />
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            aria-label={t('nav.github')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            <IconGithub className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  )
}
