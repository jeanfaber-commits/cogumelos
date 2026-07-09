import type { ComponentType } from 'react'
import {
  IconDashboard, IconFlask, IconChart, IconBox, IconHarvest, IconSettings,
} from '../icons'

export type ViewId = 'painel' | 'formulacao' | 'indicadores' | 'producao' | 'colheita' | 'config'

// Rotas que não aparecem na navegação (abertas a partir do Painel).
export type Rota = ViewId | 'conteinerDetalhe' | 'incubacaoDetalhe' | 'projecaoDetalhe'

type Item = { id: ViewId; label: string; Icon: ComponentType<{ size?: number }> }

// Ordem fixa de navegação. Adicionar uma nova tela é só incluir aqui.
export const NAV_ITEMS: Item[] = [
  { id: 'painel', label: 'Painel', Icon: IconDashboard },
  { id: 'formulacao', label: 'Formulação', Icon: IconFlask },
  { id: 'indicadores', label: 'Indicadores', Icon: IconChart },
  { id: 'producao', label: 'Produção', Icon: IconBox },
  { id: 'colheita', label: 'Colheita', Icon: IconHarvest },
  { id: 'config', label: 'Configurações', Icon: IconSettings },
]

// No celular, Configurações vive no cabeçalho superior; a barra inferior fica
// só com as telas do dia a dia, ocupando a largura toda.
export const NAV_MOBILE: Item[] = NAV_ITEMS.filter((i) => i.id !== 'config')
