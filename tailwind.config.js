/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{js,ts,jsx,tsx,html}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          primary: 'rgba(24, 24, 27, 0.95)',
          hover: 'rgba(39, 39, 42, 1)',
          active: 'rgba(63, 63, 70, 1)',
        },
        border: {
          subtle: 'rgba(63, 63, 70, 0.8)',
          visible: 'rgba(82, 82, 91, 1)',
        },
        anno: {
          green: '#22C55E',
          red: '#EF4444',
          blue: '#3B82F6',
          yellow: '#EAB308',
          orange: '#F97316',
          purple: '#A855F7',
          cyan: '#06B6D4',
          white: '#FFFFFF',
        },
      },
      fontSize: {
        xs: ['11px', { lineHeight: '1.4' }],
        sm: ['12px', { lineHeight: '1.5' }],
        base: ['13px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.3)',
        md: '0 4px 12px rgba(0,0,0,0.4)',
        lg: '0 8px 24px rgba(0,0,0,0.5)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      animation: {
        'toast-in': 'toast-in 200ms ease-out',
        'toast-out': 'toast-out 150ms ease-in',
      },
      keyframes: {
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
      },
    },
  },
  plugins: [],
};
