/**
 * LanguageSwitcher Component — Super Admin V2
 * Dropdown to switch between en/yo/ig/ha
 * Nigeria First: Yorùbá, Igbo, Hausa listed prominently
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/hooks/useTranslation'
import type { SupportedLocale } from '@/i18n'

export function LanguageSwitcher() {
  const { locale, setLocale, localeOptions } = useTranslation()

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as SupportedLocale)}>
      <SelectTrigger className="w-32 h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {localeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            <span className="font-medium">{opt.nativeName}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
