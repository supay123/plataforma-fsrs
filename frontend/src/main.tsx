import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles.css'
import { App } from './app/App.tsx'
import { bootstrapTheme } from './lib/theme/theme-store'

// Aplica el tema guardado antes de pintar, para evitar un destello con los colores por defecto.
bootstrapTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
