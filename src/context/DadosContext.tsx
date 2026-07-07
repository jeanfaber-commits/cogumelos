import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabaseConfigured } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { useConfig } from './ConfigContext'
import {
  listarMovimentacoes, calcularSaldos, registrarMovimentacao, cancelarMovimentacao,
  type Movimentacao, type ItemEstoque, type TipoMov,
} from '../lib/estoque'
import {
  listarLotes, ocupacaoIncubacaoKg, ocupacaoConteinerKg, bolsasFrutificando,
  criarLoteComposto, criarLoteSpawn, criarLoteProducao,
  marcarPronto, moverParaConteiner, encerrarLote, cancelarLote,
  registrarContaminacao, sanidadeAgregada,
  type Lote, type TipoLote,
} from '../lib/lotes'
import {
  listarColheitas, registrarColheita, cancelarColheita, eficienciaBiologicaAgregada,
  type Colheita, type Turno,
} from '../lib/colheita'

type DadosCtx = {
  carregando: boolean
  movimentacoes: Movimentacao[]
  lotes: Lote[]
  colheitas: Colheita[]
  saldos: Record<ItemEstoque, number>
  ocupacaoIncubacaoKg: number
  ocupacaoConteinerKg: number
  bolsasFrutificando: number
  eficienciaBiologica: number | null
  sanidade: number | null
  recarregar: () => Promise<void>
  novaMovimentacao: (item: ItemEstoque, quantidade: number, tipo: TipoMov, obs?: string) => Promise<string | null>
  cancelarMov: (id: number) => Promise<string | null>
  novoLote: (tipo: TipoLote, kg: number) => Promise<string | null>
  loteMarcarPronto: (l: Lote) => Promise<string | null>
  loteMoverConteiner: (l: Lote, conteiner: number) => Promise<string | null>
  loteEncerrar: (l: Lote) => Promise<string | null>
  loteCancelar: (l: Lote) => Promise<string | null>
  loteContaminacao: (l: Lote, bolsas: number) => Promise<string | null>
  novaColheita: (conteiner: number, peso: number, turno: Turno | null, obs?: string) => Promise<string | null>
  cancelarColh: (id: number) => Promise<string | null>
}

const Ctx = createContext<DadosCtx>(null as unknown as DadosCtx)
export const useDados = () => useContext(Ctx)

export function DadosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { config } = useConfig()
  const [movimentacoes, setMovs] = useState<Movimentacao[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [colheitas, setColheitas] = useState<Colheita[]>([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    if (!supabaseConfigured) { setCarregando(false); return }
    const [m, l, c] = await Promise.all([listarMovimentacoes(), listarLotes(), listarColheitas()])
    setMovs(m); setLotes(l); setColheitas(c); setCarregando(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  const saldos = useMemo(() => calcularSaldos(movimentacoes), [movimentacoes])
  const ocInc = useMemo(() => ocupacaoIncubacaoKg(lotes, config), [lotes, config])
  const ocCont = useMemo(() => ocupacaoConteinerKg(lotes), [lotes])
  const bolsas = useMemo(() => bolsasFrutificando(lotes), [lotes])
  const be = useMemo(() => eficienciaBiologicaAgregada(colheitas, lotes, config), [colheitas, lotes, config])
  const san = useMemo(() => sanidadeAgregada(lotes), [lotes])

  const comReload = async (p: Promise<string | null>) => {
    const erro = await p
    if (!erro) await recarregar()
    return erro
  }

  const value: DadosCtx = {
    carregando, movimentacoes, lotes, colheitas, saldos,
    ocupacaoIncubacaoKg: ocInc, ocupacaoConteinerKg: ocCont, bolsasFrutificando: bolsas,
    eficienciaBiologica: be, sanidade: san,
    recarregar,
    novaMovimentacao: (item, quantidade, tipo, obs) =>
      comReload(registrarMovimentacao({ item, quantidade, tipo, observacao: obs }, user?.id)),
    cancelarMov: (id) => comReload(cancelarMovimentacao(id, user?.id)),
    novoLote: (tipo, kg) => {
      const fn = tipo === 'composto' ? criarLoteComposto : tipo === 'spawn' ? criarLoteSpawn : criarLoteProducao
      return comReload(fn(config, kg, user?.id))
    },
    loteMarcarPronto: (l) => comReload(marcarPronto(l, user?.id)),
    loteMoverConteiner: (l, conteiner) => comReload(moverParaConteiner(l, conteiner, config, user?.id)),
    loteEncerrar: (l) => comReload(encerrarLote(l, user?.id)),
    loteCancelar: (l) => comReload(cancelarLote(l, user?.id)),
    loteContaminacao: (l, bolsas) => comReload(registrarContaminacao(l, bolsas, user?.id)),
    novaColheita: (conteiner, peso, turno, obs) =>
      comReload(registrarColheita({ conteiner, peso_kg: peso, turno, observacao: obs }, user?.id)),
    cancelarColh: (id) => comReload(cancelarColheita(id, user?.id)),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
