/**
 * useTranslation Hook — Super Admin V2
 * Provides t(), locale, setLocale, formatKobo, formatDate
 * Persistence: localStorage key 'webwaka_locale'
 * Nigeria First: NGN/kobo formatting built-in
 */

import { useState, useCallback } from 'react'
import {
  type SupportedLocale,
  getStoredLocale,
  setStoredLocale,
  getTranslation,
  formatKobo as formatKoboUtil,
  formatDate as formatDateUtil,
  LOCALE_OPTIONS,
} from '@/i18n'

export interface UseTranslationReturn {
  /** Current locale code */
  locale: SupportedLocale
  /** Set locale and persist to localStorage */
  setLocale: (locale: SupportedLocale) => void
  /** Translate a key using dot notation, e.g. t('partners.title') */
  t: (key: string, params?: Record<string, string | number>) => string
  /** Format kobo amount to ₦ string */
  formatKobo: (kobo: number, compact?: boolean) => string
  /** Format date string to locale-aware display */
  formatDate: (dateStr: string | undefined, options?: Intl.DateTimeFormatOptions) => string
  /** Available locale options for language switcher */
  localeOptions: typeof LOCALE_OPTIONS
}

/**
 * useTranslation — lightweight i18n hook for Super Admin V2
 *
 * @example
 * const { t, locale, setLocale, formatKobo } = useTranslation()
 * <h1>{t('dashboard.title')}</h1>
 * <p>{formatKobo(partner.monthly_fee_kobo)}</p>
 */
export function useTranslation(): UseTranslationReturn {
  const [locale, setLocaleState] = useState<SupportedLocale>(getStoredLocale)

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setStoredLocale(newLocale)
    setLocaleState(newLocale)
    // Update <html lang> attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      getTranslation(locale, key, params),
    [locale]
  )

  const formatKobo = useCallback(
    (kobo: number, compact = false) => formatKoboUtil(kobo, locale, compact),
    [locale]
  )

  const formatDate = useCallback(
    (dateStr: string | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDateUtil(dateStr, locale, options),
    [locale]
  )

  return {
    locale,
    setLocale,
    t,
    formatKobo,
    formatDate,
    localeOptions: LOCALE_OPTIONS,
  }
}
