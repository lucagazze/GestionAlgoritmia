import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Prevents "process is not defined" error in browser
      // and maps VITE_GOOGLE_API_KEY to process.env.API_KEY for the SDK
      'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY || env.API_KEY || ''),
    },
  }
})