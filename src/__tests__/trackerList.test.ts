import { describe, expect, it } from 'vitest'
import {
  addTrackers,
  parseTrackerList,
  removeTrackers,
  replaceTracker,
  serializeTrackerList,
} from '../utils/trackerList'

describe('parseTrackerList', () => {
  it('splits tiers on blank lines and trims URLs', () => {
    expect(
      parseTrackerList('https://a/announce\n\nhttps://b/announce\nhttps://c/announce\n'),
    ).toEqual([['https://a/announce'], ['https://b/announce', 'https://c/announce']])
  })

  it('collapses repeated blank lines and ignores empty input', () => {
    expect(parseTrackerList('https://a\n\n\n\nhttps://b')).toEqual([['https://a'], ['https://b']])
    expect(parseTrackerList('')).toEqual([])
  })

  it('round-trips through serializeTrackerList', () => {
    const text = 'https://a\n\nhttps://b\nhttps://c'
    expect(serializeTrackerList(parseTrackerList(text))).toBe(text)
  })
})

describe('addTrackers', () => {
  it('appends new URLs as a trailing tier', () => {
    expect(addTrackers('https://a', ['https://b', 'https://c'])).toBe(
      'https://a\n\nhttps://b\nhttps://c',
    )
  })

  it('skips duplicates and empty lines', () => {
    expect(addTrackers('https://a', ['https://a', '', '  '])).toBe('https://a')
    expect(addTrackers('', ['https://a'])).toBe('https://a')
  })
})

describe('removeTrackers', () => {
  it('removes URLs across tiers and drops empty tiers', () => {
    const text = 'https://a\n\nhttps://b\nhttps://c'
    expect(removeTrackers(text, ['https://a', 'https://c'])).toBe('https://b')
    expect(removeTrackers(text, ['https://b'])).toBe('https://a\n\nhttps://c')
  })

  it('returns an empty string when everything is removed', () => {
    expect(removeTrackers('https://a', ['https://a'])).toBe('')
  })
})

describe('replaceTracker', () => {
  it('replaces in place, keeping tier and position', () => {
    const text = 'https://a\n\nhttps://b\nhttps://c'
    expect(replaceTracker(text, 'https://b', 'https://d')).toBe('https://a\n\nhttps://d\nhttps://c')
    expect(replaceTracker(text, 'https://missing', 'https://d')).toBe(text)
  })
})
