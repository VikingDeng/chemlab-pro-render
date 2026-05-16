import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TestPage } from './TestPage.tsx'

const isTest = import.meta.env.DEV && window.location.pathname === '/test';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTest ? <TestPage /> : <App />}
  </StrictMode>,
)
