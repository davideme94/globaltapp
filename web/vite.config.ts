import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/globaltapp/' // <- MUY IMPORTANTE para GH Pages
})
