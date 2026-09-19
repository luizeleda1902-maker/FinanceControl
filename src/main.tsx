// Ponto de entrada do app: monta o componente <App /> dentro da <div id="root">
// do index.html. Arquivo padrão gerado pelo Vite, sem lógica própria.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
