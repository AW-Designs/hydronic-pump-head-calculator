/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1E2A3A',
        appbg: '#F8F9FA',
        accent: '#2563EB',
        chw: '#2563EB',
        hw: '#EA580C',
        cw: '#0D9488',
        warnRed: '#DC2626',
        warnYellow: '#D97706',
        border: '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
