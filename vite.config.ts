import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    // Automatically use repository name only in production builds (GitHub Pages)
    base: command === 'build' ? '/Rework-Tracker/' : '/',
    define: {
      __LOCAL_IP__: JSON.stringify('192.168.1.152'),
      __PORT__: 5001
    },
    server: {
      host: '0.0.0.0', // Listen on all network interfaces
      port: 5001,      // Port number
      strictPort: true // Fail if port is already in use
    }
  }
})
