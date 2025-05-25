import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7071',
        changeOrigin: true,
        autoRewrite: true,
      },
    },
  },
  resolve: {
    alias: {
      '~': "/src",
    },
  },
})


// import react from '@vitejs/plugin-react'
// import { defineConfig } from 'vite'

// export default defineConfig({
//   build: {
//     minify: true,
//     outDir: './pages',
//   },
//   plugins: [react()],
// })
