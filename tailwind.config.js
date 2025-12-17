/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        racing: {
          red: '#dc2626',
          yellow: '#fbbf24',
          green: '#10b981',
          blue: '#3b82f6',
          gray: '#6b7280',
          black: '#111827'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        racing: ['Orbitron', 'monospace'],
        display: ['Bebas Neue', 'sans-serif']
      },
      animation: {
        'pulse-racing': 'pulse-racing 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'zoom-in': 'zoom-in 0.2s ease-out',
      },
      keyframes: {
        'pulse-racing': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 }
        },
        'slide-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      },
      backgroundImage: {
        'circuit-pattern': "url('/images/patterns/circuit.svg')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-racing': 'linear-gradient(135deg, #dc2626 0%, #1e40af 100%)'
      }
    },
  },
  plugins: [],
}
