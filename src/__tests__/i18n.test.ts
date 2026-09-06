import { describe, expect, it } from 'vitest'
import zhCN from '../i18n/locales/zh-CN'
import en from '../i18n/locales/en'

/** Guard: the two locales must stay key-for-key parallel. */

type Messages = Record<string, unknown>

function flattenKeys(obj: Messages, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flattenKeys(value as Messages, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

function emptyPaths(obj: Messages, prefix = ''): string[] {
  const out: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = `${prefix}${key}`
    if (typeof value === 'string') {
      if (value.trim() === '') out.push(path)
    } else if (typeof value === 'object' && value !== null) {
      out.push(...emptyPaths(value as Messages, `${path}.`))
    } else {
      out.push(path) // non-string leaf (should not happen)
    }
  }
  return out
}

describe('locale parity', () => {
  it('en and zh-CN have identical key sets', () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(zhCN).sort())
  })

  it('has no empty messages in either locale', () => {
    expect(emptyPaths(zhCN)).toEqual([])
    expect(emptyPaths(en)).toEqual([])
  })
})
