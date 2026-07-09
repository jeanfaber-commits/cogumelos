import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabaseConfigured } from '../lib/supabase'
import { tetoSustentavel, type Config, type ResultadoTeto, type Ingrediente } from '../lib/calculos'
import { calibrarTempos, aplicarTempos, type TemposReais } from '../lib/calibracao'
import { listarContaminacoes, type Contaminacao, type CausaContaminacao } from '../lib/contaminacao'
import { listarDescartes, type Descarte, type MotivoDescarte } from '../lib/descarte'
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
  registrarContaminacao, registrarDescarte, sanidadeAgregada, gerarCodigoLote, codigoParcial,
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
  temposReais: TemposReais
  configEfetiva: Config
  teto: ResultadoTeto
  contaminacoes: Contaminacao[]
  descartes: Descarte[]
  recarregar: () => Promise<void>
  novaMovimentacao: (item: ItemEstoque, quantidade: number, tipo: TipoMov, obs?: string) => Promise<string | null>
  cancelarMov: (id: number) => Promise<string | null>
  novoLote: (tipo: TipoLote, kg: number, bolsas: number | null, iniciadoEm?: Date, receita?: Ingrediente[]) => Promise<string | null>
  loteMarcarPronto: (l: Lote) => Promise<string | null>
  loteMoverConteiner: (l: Lote, conteiner: number, bolsasMover?: number | null) => Promise<string | null>
  loteEncerrar: (l: Lote) => Promise<string | null>
  loteCancelar: (l: Lote) => Promise<string | null>
  loteContaminacao: (l: Lote, bolsas: number, causa: CausaContaminacao) => Promise<string | null>
  loteDescarte: (l: Lote, bolsas: number, motivo: MotivoDescarte) => Promise<string | null>
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
  const [contaminacoes, setContaminacoes] = useState<Contaminacao[]>([])
  const [descartes, setDescartes] = useState<Descarte[]>([])
  const [carregando, setCarregando] = useState(true)

  const recarregar = useCallback(async () => {
    if (!supabaseConfigured) { setCarregando(false); return }
    const [m, l, c, ct, ds] = await Promise.all([listarMovimentacoes(), listarLotes(), listarColheitas(), listarContaminacoes(), listarDescartes()])
    setMovs(m); setLotes(l); setColheitas(c); setContaminacoes(ct); setDescartes(ds); setCarregando(false)
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  // Num PWA instalado não há "puxar para atualizar" e o app pode voltar de um
  // estado congelado sem rebuscar nada. Então reatualizamos os dados quando a
  // tela volta a ficar visível (reabrir o app, voltar para a aba), ao reconectar
  // à internet e a cada minuto enquanto está aberto. Também pedimos ao service
  // worker para checar se há versão nova do aplicativo.
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState !== 'visible') return
      recarregar()
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('focus', atualizar)
    window.addEventListener('online', atualizar)
    const id = window.setInterval(atualizar, 60000)
    return () => {
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('focus', atualizar)
      window.removeEventListener('online', atualizar)
      window.clearInterval(id)
    }
  }, [recarregar])

  const saldos = useMemo(() => calcularSaldos(movimentacoes), [movimentacoes])
  const ocInc = useMemo(() => ocupacaoIncubacaoKg(lotes, config), [lotes, config])
  const ocCont = useMemo(() => ocupacaoConteinerKg(lotes), [lotes])
  const bolsas = useMemo(() => bolsasFrutificando(lotes), [lotes])
  const be = useMemo(() => eficienciaBiologicaAgregada(colheitas, lotes, config), [colheitas, lotes, config])
  const san = useMemo(() => sanidadeAgregada(lotes), [lotes])
  const temposReais = useMemo(() => calibrarTempos(lotes), [lotes])
  const configEfetiva = useMemo(() => aplicarTempos(config, temposReais), [config, temposReais])
  const teto = useMemo(() => tetoSustentavel(configEfetiva), [configEfetiva])

  const comReload = async (p: Promise<string | null>) => {
    const erro = await p
    if (!erro) await recarregar()
    return erro
  }

  const value: DadosCtx = {
    carregando, movimentacoes, lotes, colheitas, saldos,
    ocupacaoIncubacaoKg: ocInc, ocupacaoConteinerKg: ocCont, bolsasFrutificando: bolsas,
    eficienciaBiologica: be, sanidade: san,
    temposReais, configEfetiva, teto, contaminacoes, descartes,
    recarregar,
    novaMovimentacao: (item, quantidade, tipo, obs) =>
      comReload(registrarMovimentacao({ item, quantidade, tipo, observacao: obs }, user?.id)),
    cancelarMov: (id) => comReload(cancelarMovimentacao(id, user?.id)),
    novoLote: (tipo, kg, bolsas, iniciadoEm, receita) => {
      const codigo = gerarCodigoLote(tipo, lotes, iniciadoEm)
      const p =
        tipo === 'composto' ? criarLoteComposto(config, kg, codigo, user?.id, iniciadoEm, receita)
        : tipo === 'spawn' ? criarLoteSpawn(config, kg, bolsas, codigo, user?.id, iniciadoEm)
        : criarLoteProducao(config, kg, bolsas, codigo, user?.id, iniciadoEm)
      return comReload(p)
    },
    loteMarcarPronto: (l) => comReload(marcarPronto(l, user?.id)),
    loteMoverConteiner: (l, conteiner, bolsasMover) => {
      const total = Number(l.bolsas ?? 0)
      const parcial = bolsasMover != null && bolsasMover < total && bolsasMover > 0
      const codigoFilho = parcial ? codigoParcial(l.codigo, lotes) : undefined
      return comReload(moverParaConteiner(l, conteiner, config, user?.id, bolsasMover, codigoFilho))
    },
    loteEncerrar: (l) => comReload(encerrarLote(l, user?.id)),
    loteCancelar: (l) => comReload(cancelarLote(l, user?.id)),
    loteContaminacao: (l, bolsas, causa) => comReload(registrarContaminacao(l, bolsas, causa, user?.id)),
    loteDescarte: (l, bolsas, motivo) => comReload(registrarDescarte(l, bolsas, motivo, user?.id)),
    novaColheita: (conteiner, peso, turno, obs) =>
      comReload(registrarColheita({ conteiner, peso_kg: peso, turno, observacao: obs }, user?.id)),
    cancelarColh: (id) => comReload(cancelarColheita(id, user?.id)),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
