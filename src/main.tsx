import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-800.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import App from './App'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
