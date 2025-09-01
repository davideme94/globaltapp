/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // ⬅️ habilita modo oscuro por clase
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        heading: ['Montserrat', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          'primary-600': 'var(--brand-primary-600)',
          secondary: 'var(--brand-secondary)',
          'secondary-700': 'var(--brand-secondary-700)',
          deep: 'var(--brand-deep)',
          'deep-900': 'var(--brand-deep-900)',
        },
        neutral: {
          50: 'var(--neutral-50)',
          200: 'var(--neutral-200)',
          700: 'var(--neutral-700)',
          900: 'var(--neutral-900)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      borderRadius: { xl: '12px' },
      boxShadow: { card: '0 2px 8px rgba(0,0,0,.06)' },
      backgroundImage: {
        'grad-brand': 'var(--grad-brand)',
        'grad-primary': 'var(--grad-primary)',
      },
    },
  },
  plugins: [],
}
