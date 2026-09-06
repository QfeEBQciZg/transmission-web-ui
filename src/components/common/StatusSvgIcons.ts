import { h, type FunctionalComponent } from 'vue'

/** Option 4 Minimalist SVG Status Icons */

export const IconDownload: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'M12 3v12M6 10l6 6 6-6M4 21h16' })],
  )

export const IconSeed: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'M12 17V5M6 11l6-6 6 6M4 21h16' })],
  )

/** Stacked double chevrons for torrent list */
export const IconDownloadDouble: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'M5.5 6.5l6.5 6 6.5-6M5.5 13.5l6.5 6 6.5-6' })],
  )

export const IconSeedDouble: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '3',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'M5.5 10.5l6.5-6 6.5 6M5.5 17.5l6.5-6 6.5 6' })],
  )

export const IconPause: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
    },
    [h('path', { d: 'M9 6v12M15 6v12' })],
  )

export const IconCheck: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('path', { d: 'M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5' })],
  )

export const IconActive: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' })],
  )

export const IconError: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [h('circle', { cx: '12', cy: '12', r: '9' }), h('path', { d: 'M12 8v4M12 16h.01' })],
  )

export const IconWarning: FunctionalComponent = () =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    [
      h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
      h('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
      h('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }),
    ],
  )
