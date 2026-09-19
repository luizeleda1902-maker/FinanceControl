import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Configuração do Vite. O plugin VitePWA é o que transforma o app numa
// PWA instalável: gera o manifest.json (nome/ícones usados ao "instalar"
// no celular/desktop) e o service worker (permite abrir offline).
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // atualiza o app sozinho quando sai uma versão nova
      includeAssets: ['favicon.png'],
      devOptions: { enabled: true }, // registra o service worker também em `npm run dev`, não só no build
      manifest: {
        lang: 'pt-BR',
        name: 'Finance Control',
        short_name: 'Finance Control',
        description:
          'Controle manual e 100% local de receitas, despesas, contas fixas, parcelamentos, cartão de crédito e orçamento mensal',
        theme_color: '#22c55e',
        background_color: '#0a0f1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Aparece ao pressionar e manter o ícone do app na tela inicial do
        // Android — dá pra arrastar "Lançamento por voz" pra fora como um
        // ícone separado, que abre direto em /voz já ouvindo o microfone
        // (ver src/pages/LancamentoPorVoz.tsx).
        shortcuts: [
          {
            name: 'Lançamento por voz',
            short_name: 'Lanç. por voz',
            description: 'Registrar um gasto ou receita falando, sem abrir o app inteiro',
            url: '/#/voz',
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
