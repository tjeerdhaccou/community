import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/clean-tokens.css'
import './styles/clean-components.css'
import './styles/fonts/fontawesome.min.css'
import './index.css'
import { registerServiceWorker } from './lib/push'

// PWA: service worker voor Web Push (zie public/sw.js — géén asset-caching).
if (import.meta.env.PROD) registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
