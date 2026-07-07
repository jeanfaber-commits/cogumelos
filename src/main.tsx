import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ConfigProvider } from './context/ConfigContext'
import { DadosProvider } from './context/DadosContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ConfigProvider>
          <DadosProvider>
            <App />
          </DadosProvider>
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
