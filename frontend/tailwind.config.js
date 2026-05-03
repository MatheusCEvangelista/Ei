/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'sans-serif'], mono: ['DM Mono', 'monospace'] },
      colors: {
        bg:     '#0f1117',
        bg2:    '#161922',
        bg3:    '#1e2330',
        green:  '#2dd4a0',
        red:    '#f05e6e',
        indigo: '#7c7ff7',
        amber:  '#f5a623',
      },
      borderColor: { DEFAULT: 'rgba(255,255,255,0.07)' },
    },
  },
  plugins: [],
};
