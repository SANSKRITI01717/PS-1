import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// In production the frontend and backend live on different Render URLs.
// VITE_API_URL points to the backend; every relative '/api/...' call is sent there.
// In local dev VITE_API_URL is empty, so the Vite proxy keeps working as before.
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
if (API_URL) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) =>
    originalFetch(
      typeof input === 'string' && input.startsWith('/') ? API_URL + input : input,
      init
    )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
