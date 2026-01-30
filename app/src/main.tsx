import React from 'react'
import ReactDOM from 'react-dom/client'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>,
)