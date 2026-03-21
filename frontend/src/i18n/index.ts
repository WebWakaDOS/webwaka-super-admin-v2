/**
 * WebWaka Super Admin v2 — i18n Module
 * Supported locales: en (English), yo (Yorùbá), ig (Igbo), ha (Hausa)
 * Nigeria First invariant: NGN/kobo formatting, NDPR copy in all languages
 * Persistence: localStorage key 'webwaka_locale'
 */

import en from './locales/en.json'
import yo from './locales/yo.json'
import ig from './locales/ig.json'
import ha from './locales/ha.json'

// ============================================================================
// TYPES
// ============================================================================

export type SupportedLocale = 'en' | 'yo' | 'ig' | 'ha'

export interface LocaleDefinition {
  lang: string
  langName: string
  nav: Record<string, string>
  common: Record<string, string>
  currency: {
    symbol: string
    code: string
    unit: string
    subunit: string
    locale: string
  }
  dashboard: Record<string, string>
  partners: Record<string, string | Record<string, string>>
  tenants: Record<string, string>
  billing: Record<string, string>
  operations: Record<string, string>
  deployments: Record<string, string>
  health: Record<string, string>
  settings: Record<string, string>
  auth: Record<string, string>
}

// ============================================================================
// LOCALE MAP
// ============================================================================

export const LOCALES: Record<SupportedLocale, LocaleDefinition> = {
  en: en as LocaleDefinition,
  yo: yo as LocaleDefinition,
  ig: ig as LocaleDefinition,
  ha: ha as LocaleDefinition,
}

export const LOCALE_OPTIONS: { value: SupportedLocale; label: string; nativeName: string }[] = [
  { value: 'en', label: 'English', nativeName: 'English' },
  { value: 'yo', label: 'Yoruba', nativeName: 'Yorùbá' },
  { value: 'ig', label: 'Igbo', nativeName: 'Igbo' },
  { value: 'ha', label: 'Hausa', nativeName: 'Hausa' },
]

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'webwaka_locale'

export function getStoredLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in LOCALES) return stored as SupportedLocale
  } catch (_) {}
  return 'en'
}

export function setStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch (_) {}
}

// ============================================================================
// TRANSLATION UTILITIES
// ============================================================================

/**
 * Get a nested translation value using dot notation.
 * e.g. t('partners.title') → "Partner Management"
 */
export function getTranslation(
  locale: SupportedLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const parts = key.split('.')
  let current: unknown = LOCALES[locale]

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part]
    } else {
      // Fallback to English
      current = LOCALES['en']
      for (const p of parts) {
        if (current && typeof current === 'object' && p in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[p]
        } else {
          return key // Return key as last resort
        }
      }
      break
    }
  }

  if (typeof current !== 'string') return key

  // Parameter substitution: {{param}}
  if (params) {
    return current.replace(/\{\{(\w+)\}\}/g, (_, p) =>
      p in params ? String(params[p]) : `{{${p}}}`
    )
  }

  return current
}

// ============================================================================
// CURRENCY FORMATTING (Nigeria First — kobo)
// ============================================================================

/**
 * Format kobo amount to Nigerian Naira display string.
 * @param kobo - Amount in kobo (100 kobo = ₦1)
 * @param locale - i18n locale (affects number formatting)
 * @param compact - Use compact notation (₦1.2M) for large values
 */
export function formatKobo(
  kobo: number,
  locale: SupportedLocale = 'en',
  compact = false
): string {
  const naira = kobo / 100

  if (compact) {
    if (naira >= 1_000_000_000) return `₦${(naira / 1_000_000_000).toFixed(1)}B`
    if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`
    if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(0)}K`
  }

  const intlLocale = LOCALES[locale]?.currency?.locale || 'en-NG'

  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira)
}

/**
 * Format a date string using the locale's date format.
 */
export function formatDate(
  dateStr: string | undefined,
  locale: SupportedLocale = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '—'
  const intlLocale = LOCALES[locale]?.currency?.locale || 'en-NG'
  return new Date(dateStr).toLocaleString(intlLocale, options || {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
