import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'

/** Message schema derived from the zh-CN locale (keep en in sync). */
export type MessageSchema = typeof zhCN

export const SUPPORT_LOCALES = ['zh-CN', 'en'] as const
export type SupportLocale = (typeof SUPPORT_LOCALES)[number]

export const DEFAULT_LOCALE: SupportLocale = 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
  },
})
