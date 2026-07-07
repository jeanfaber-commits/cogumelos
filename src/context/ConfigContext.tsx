import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Config } from '../lib/calculos'
import { tetoSustentavel } from '../lib/calculos'
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '../lib/config'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'

type Estado = 'idle' | 'salvando' | 'ok' | 'erro'

type ConfigCtx = {
  config: Config
  atualizar: (patch: Partial<Config>) => void
  atualizarIngrediente: (i: number, patch: Partial<Config['ingredientesComposto'][number]>) => void
  salvar: () => Promise<void>
  restaurarPadrao: () => void
  estado: Estado
  mensagem: string
  carregando: boolean
  persistencia: boolean // true se o Supabase está configurado (dá para salvar)
}

const Ctx = createContext<ConfigCtx>(null as unknown as ConfigCtx)
export const useConfig = () => useContext(Ctx)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [carregando, setCarregando] = useState(true)
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (!supabaseConfigured) { setCarregando(false); return }
    loadConfig()
      .then((c) => { if (c) setConfig(c) })
      .finally(() => setCarregando(false))
  }, [])

  const atualizar = (patch: Partial<Config>) => {
    setConfig((c) => ({ ...c, ...patch }))
    setEstado('idle'); setMensagem('')
  }

  const atualizarIngrediente: ConfigCtx['atualizarIngrediente'] = (i, patch) => {
    setConfig((c) => {
      const lista = c.ingredientesComposto.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing))
      return { ...c, ingredientesComposto: lista }
    })
    setEstado('idle'); setMensagem('')
  }

  const salvar = async () => {
    if (!supabaseConfigured) {
      setEstado('erro'); setMensagem('Configure o Supabase para salvar (veja o README).')
      return
    }
    setEstado('salvando'); setMensagem('')
    const erro = await saveConfig(config, user?.id)
    if (erro) { setEstado('erro'); setMensagem(erro) }
    else { setEstado('ok'); setMensagem('Configuração salva e cálculos atualizados.') }
  }

  const restaurarPadrao = () => { setConfig(DEFAULT_CONFIG); setEstado('idle'); setMensagem('') }

  // O teto é recalculado a cada mudança na configuração.
  const teto = useMemo(() => tetoSustentavel(config), [config])

  const value: ConfigCtx & { teto: typeof teto } = {
    config, atualizar, atualizarIngrediente, salvar, restaurarPadrao,
    estado, mensagem, carregando, persistencia: supabaseConfigured, teto,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// Exponho o teto junto do contexto para o Painel e Configurações usarem.
export function useTeto() {
  return (useContext(Ctx) as ConfigCtx & { teto: ReturnType<typeof tetoSustentavel> }).teto
}
