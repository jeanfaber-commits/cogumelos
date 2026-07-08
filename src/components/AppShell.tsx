import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { NavProvider } from '../context/NavContext'
import { NAV_ITEMS, type Rota } from './Nav'
import { IconMushroom, IconSun, IconMoon, IconLogout } from '../icons'

import Painel from '../views/Painel'
import Formulacao from '../views/Formulacao'
import Indicadores from '../views/Indicadores'
import Producao from '../views/Estoque'
import Colheita from '../views/Colheita'
import Configuracoes from '../views/Configuracoes'
import ConteinerDetalhe from '../views/ConteinerDetalhe'
import IncubacaoDetalhe from '../views/IncubacaoDetalhe'

const VIEWS: Record<Rota, () => JSX.Element> = {
  painel: Painel,
  formulacao: Formulacao,
  indicadores: Indicadores,
  producao: Producao,
  colheita: Colheita,
  config: Configuracoes,
  conteinerDetalhe: ConteinerDetalhe,
  incubacaoDetalhe: IncubacaoDetalhe,
}

// Rotas de detalhe destacam "Painel" na navegação.
const DETALHES: Rota[] = ['conteinerDetalhe', 'incubacaoDetalhe']

export default function AppShell() {
  const [rota, setRota] = useState<Rota>('painel')
  const { theme, toggle } = useTheme()
  const { signOut } = useAuth()
  const View = VIEWS[rota]
  const ativo = (id: Rota) => rota === id || (id === 'painel' && DETALHES.includes(rota))

  return (
    <NavProvider value={{ rota, irPara: setRota }}>
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
              <button key={id} className={`nav-item ${ativo(id) ? 'active' : ''}`}
                onClick={() => setRota(id)} aria-current={ativo(id)}>
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
            <button key={id} className={`bottom-item ${ativo(id) ? 'active' : ''}`}
              onClick={() => setRota(id)} aria-current={ativo(id)}>
              <Icon size={24} /> {label}
            </button>
          ))}
        </nav>
      </div>
    </NavProvider>
  )
}
