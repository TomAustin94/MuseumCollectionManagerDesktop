import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Forward unhandled renderer errors to the main-process log file
window.addEventListener('error', (e) => {
  window.api?.log?.error(`Uncaught: ${e.error?.stack ?? e.message}`)
})
window.addEventListener('unhandledrejection', (e) => {
  window.api?.log?.error(`Unhandled rejection: ${String(e.reason)}`)
})

window.api?.log?.info('renderer started')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
