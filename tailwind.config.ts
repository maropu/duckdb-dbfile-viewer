import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
  // Next.js 15の使用でより確実に動作させるために
  // これらの設定を追加
  future: {
    hoverOnlyWhenSupported: true,
  },
  // React 19に特化した設定
  // デフォルトのTailwindスタイルを明示的に適用
  corePlugins: {
    preflight: true,
  },
}

export default config