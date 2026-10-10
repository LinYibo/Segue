import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import en from './dict.en.js'
import zh from './dict.zh.js'

/**
 * Dependency-free i18n: two dictionaries with an identical shape, a dot-path
 * lookup, and localStorage persistence. Small enough that a library would only
 * add weight.
 */
const DICTS = { en, zh }
const LANGS = ['en', 'zh']
const STORAGE_KEY = 'segue-lang'

const I18nContext = createContext(null)

function detectLang() {
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved && LANGS.includes(saved)) return saved
  return window.navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function resolve(dict, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), dict)
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return
    setLangState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    document.title = DICTS[lang].meta.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', DICTS[lang].meta.description)
  }, [lang])

  const value = useMemo(() => {
    const dict = DICTS[lang]
    const t = (path) => {
      const hit = resolve(dict, path)
      if (hit === undefined) {
        // Fail loudly in the console instead of rendering a blank.
        console.warn(`[i18n] missing key: ${path}`)
        return path
      }
      return hit
    }
    return { lang, setLang, t }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>')
  return value
}
