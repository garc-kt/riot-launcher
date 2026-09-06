import type { Config } from 'tailwindcss'

export default {
  prefix: 'cp-',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        lol: {
          gold: '#c89b3c',
          goldLight: '#f0e6d2',
          goldDark: '#785a28',
          blue: '#0ac8b9',
          blueDark: '#0397ab',
          darkBg: '#010a13',
          darkSurface: '#091428',
          darkBorder: '#1e282d',
          darkCard: '#0e1e2d',
          textMuted: '#a09b8c',
          textNormal: '#cdbe91',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
