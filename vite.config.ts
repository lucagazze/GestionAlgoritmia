
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Maps the VITE_ var to process.env.API_KEY as required by the new SDK guidelines
      // Using the provided key as default if env var is not set
      'process.env.API_KEY': JSON.stringify(env.VITE_GOOGLE_API_KEY || 'AIzaSyDJbRiTDcQz_Irceu7RI0hYaqpluzLhynw'),
    },
  }
})
