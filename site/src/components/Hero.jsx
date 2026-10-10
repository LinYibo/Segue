import { SITE } from '../config.js'
import { useI18n } from '../i18n/index.jsx'
import { IconArrowRight, IconGithub } from './icons.jsx'
import { LinkButton } from './ui.jsx'

export function Hero() {
  const { t } = useI18n()

  return (
    <section id="top" className="relative overflow-hidden">
      {/* A soft paper-tinted glow behind the hero, echoing the app's reading surface. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[34rem] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(90,111,133,0.14),transparent_70%)]"
      />

      <div className="relative mx-auto grid max-w-5xl gap-12 px-5 pb-4 pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-14 lg:pt-20">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Segue</h1>
          <p className="mt-5 font-serif text-2xl leading-snug text-fg">{t('hero.tagline')}</p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted">{t('hero.lead')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <LinkButton href={SITE.appUrl}>
              {t('hero.ctaTry')}
              <IconArrowRight />
            </LinkButton>
            <LinkButton href={SITE.repo} variant="ghost">
              <IconGithub className="h-4 w-4" />
              {t('hero.ctaGithub')}
            </LinkButton>
          </div>
          <p className="mt-4 text-xs leading-5 text-subtle">{t('hero.note')}</p>
        </div>

        <WorkbenchMock />
      </div>
    </section>
  )
}

/** A CSS rendering of the workbench (no screenshot to keep in sync). */
function WorkbenchMock() {
  return (
    <div
      aria-hidden="true"
      className="select-none overflow-hidden rounded-xl border border-border bg-bg shadow-[0_24px_60px_-24px_rgba(28,27,24,0.25)]"
    >
      {/* Title bar with tabs */}
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-surface px-3">
        <span className="text-[11px] font-medium tracking-tight">Segue</span>
        <span className="ml-2 flex h-5 items-center rounded bg-elevated px-2 text-[10px] text-fg">
          The Wealth of Nations.pdf
        </span>
        <span className="flex h-5 items-center px-2 text-[10px] text-subtle">Second Treatise.epub</span>
      </div>
      <div className="flex h-64">
        {/* Activity rail */}
        <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-border py-2.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`size-5 rounded ${i === 0 ? 'bg-elevated' : 'bg-surface'}`} />
          ))}
        </div>
        {/* Sidebar: library */}
        <div className="hidden w-32 shrink-0 flex-col gap-1.5 border-r border-border bg-surface/60 p-2.5 sm:flex">
          <span className="text-[9px] font-medium tracking-wide text-subtle uppercase">library</span>
          <div className="rounded bg-elevated p-1.5">
            <span className="block h-1.5 w-20 rounded bg-fg/40" />
            <span className="mt-1 block h-1.5 w-12 rounded bg-fg/20" />
          </div>
          <div className="rounded p-1.5">
            <span className="block h-1.5 w-16 rounded bg-fg/25" />
            <span className="mt-1 block h-1.5 w-10 rounded bg-fg/15" />
          </div>
          <span className="mt-2 text-[9px] font-medium tracking-wide text-subtle uppercase">
            outline
          </span>
          <span className="block h-1.5 w-14 rounded bg-fg/20" />
          <span className="block h-1.5 w-20 rounded bg-fg/15" />
        </div>
        {/* Reader */}
        <div className="min-w-0 flex-1 p-4">
          <div className="space-y-2 font-serif">
            <div className="h-2.5 w-3/5 rounded bg-fg/50" />
            <div className="h-1.5 w-full rounded bg-fg/15" />
            <div className="h-1.5 w-11/12 rounded bg-fg/15" />
            <div className="h-1.5 w-full rounded bg-mark" />
            <div className="h-1.5 w-4/5 rounded bg-fg/15" />
            <div className="h-1.5 w-full rounded bg-fg/15" />
            <div className="h-1.5 w-2/3 rounded bg-fg/15" />
          </div>
        </div>
        {/* Chat pane with a citation chip */}
        <div className="hidden w-40 shrink-0 flex-col gap-2 border-l border-border p-2.5 md:flex">
          <span className="text-[9px] font-medium tracking-wide text-subtle uppercase">ask</span>
          <div className="self-end rounded-lg bg-elevated px-2 py-1.5">
            <span className="block h-1.5 w-20 rounded bg-fg/30" />
            <span className="mt-1 block h-1.5 w-16 rounded bg-fg/30" />
          </div>
          <div className="rounded-lg border border-border bg-surface px-2 py-1.5">
            <span className="block h-1.5 w-full rounded bg-fg/20" />
            <span className="mt-1 block h-1.5 w-5/6 rounded bg-fg/20" />
            <span className="mt-1.5 inline-block rounded-sm bg-black/10 px-1 font-mono text-[8px] text-accent">
              [C1] p.412
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
