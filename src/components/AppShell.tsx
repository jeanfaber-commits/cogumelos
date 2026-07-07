import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { NAV_ITEMS, type ViewId } from './Nav'
import { IconMushroom, IconSun, IconMoon, IconLogout } from '../icons'

import Painel from '../views/Painel'
import Formulacao from '../views/Formulacao'
import Indicadores from '../views/Indicadores'
import Producao from '../views/Estoque'
import Colheita from '../views/Colheita'
import Configuracoes from '../views/Configuracoes'

const VIEWS: Record<ViewId, () => JSX.Element> = {
  painel: Painel,
  formulacao: Formulacao,
  indicadores: Indicadores,
  producao: Producao,
  colheita: Colheita,
  config: Configuracoes,
}

export default function AppShell() {
  const [view, setView] = useState<ViewId>('painel')
  const { theme, toggle } = useTheme()
  const { signOut } = useAuth()
  const View = VIEWS[view]

  return (
    <div className="shell">
      {/* ----- Barra lateral (desktop / tablet largo) ----- */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><IconMushroom size={20} /></div>
          <div>
            <div className="brand-name">Cogumelos</div>
            <div className="brand-sub">Controle de produção</div>
          </div>
        </div>

        <nav className="nav-scroll">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)} aria-current={view === id}>
              <Icon size={22} /> {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={toggle}>
            {theme === 'dark' ? <IconSun size={22} /> : <IconMoon size={22} />}
            {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          </button>
          <button className="nav-item" onClick={signOut}>
            <IconLogout size={22} /> Sair
          </button>
        </div>
      </aside>

      {/* ----- Cabeçalho (celular) ----- */}
      <header className="mobile-header">
        <div className="brand">
          <div className="brand-mark"><IconMushroom size={18} /></div>
          <div className="brand-name">Cogumelos</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost" style={{ padding: '0 12px', minWidth: 48 }}
            onClick={toggle} aria-label="Alternar tema">
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
          <button className="btn btn-ghost" style={{ padding: '0 12px', minWidth: 48 }}
            onClick={signOut} aria-label="Sair">
            <IconLogout size={20} />
          </button>
        </div>
      </header>

      {/* ----- Conteúdo da tela atual ----- */}
      <main className="main">
        <div className="main-inner">
          <View />
        </div>
      </main>

      {/* ----- Barra inferior (celular) ----- */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id} className={`bottom-item ${view === id ? 'active' : ''}`}
            onClick={() => setView(id)} aria-current={view === id}>
            <Icon size={24} /> {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
