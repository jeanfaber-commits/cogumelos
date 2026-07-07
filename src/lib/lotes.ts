import { supabase } from './supabase'
import type { Config } from './calculos'
import type { ItemEstoque, TipoMov } from './estoque'

export type TipoLote = 'composto' | 'spawn' | 'producao'
export type EtapaLote =
  | 'preparo' | 'pronto'            // composto
  | 'incubando'                     // spawn
  | 'colonizando' | 'frutificando' | 'encerrado' // produção

export type Lote = {
  id: number
  codigo: string
  tipo: TipoLote
  etapa: EtapaLote
  quantidade_kg: number
  bolsas: number | null
  bolsas_contaminadas: number
  conteiner: number | null
  iniciado_em: string
  etapa_desde: string
  previsto_para: string | null
  observacao: string | null
  cancelado_em: string | null
}

const ROTULO_TIPO: Record<TipoLote, string> = {
  composto: 'Composto',
  spawn: 'Spawn',
  producao: 'Produção',
}
export const rotuloTipoLote = (t: TipoLote) => ROTULO_TIPO[t]

const ROTULO_ETAPA: Record<EtapaLote, string> = {
  preparo: 'Em preparo',
  pronto: 'Pronto',
  incubando: 'Incubando',
  colonizando: 'Colonizando',
  frutificando: 'Frutificando',
  encerrado: 'Encerrado',
}
export const rotuloEtapa = (e: EtapaLote) => ROTULO_ETAPA[e]

// Etapas que ainda ocupam recurso / estão em andamento.
export const ETAPAS_ATIVAS: EtapaLote[] = ['preparo', 'incubando', 'colonizando', 'frutificando']
export const emAndamento = (l: Lote) => !l.cancelado_em && ETAPAS_ATIVAS.includes(l.etapa)

// ---------- Ocupação (calculada dos lotes ativos) ----------
export function ocupacaoIncubacaoKg(lotes: Lote[], c: Config): number {
  let total = 0
  for (const l of lotes) {
    if (l.cancelado_em) continue
    if (l.tipo === 'spawn' && l.etapa === 'incubando') total += Number(l.quantidade_kg) * c.fatorOcupacaoSpawn
    else if (l.tipo === 'producao' && l.etapa === 'colonizando') total += Number(l.quantidade_kg) * c.fatorOcupacaoSubstrato
  }
  return total
}

export function ocupacaoConteinerKg(lotes: Lote[]): number {
  let total = 0
  for (const l of lotes)
    if (!l.cancelado_em && l.tipo === 'producao' && l.etapa === 'frutificando') total += Number(l.quantidade_kg)
  return total
}

export function bolsasFrutificando(lotes: Lote[]): number {
  let n = 0
  for (const l of lotes)
    if (!l.cancelado_em && l.tipo === 'producao' && l.etapa === 'frutificando') n += Number(l.bolsas ?? 0)
  return n
}

// ---------- Utilitários ----------
function emDias(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString()
}
function gerarCodigo(prefixo: string): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${prefixo}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export async function listarLotes(): Promise<Lote[]> {
  const { data, error } = await supabase
    .from('lote')
    .select('id,codigo,tipo,etapa,quantidade_kg,bolsas,bolsas_contaminadas,conteiner,iniciado_em,etapa_desde,previsto_para,observacao,cancelado_em')
    .order('iniciado_em', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return data as Lote[]
}

type Mov = { item: ItemEstoque; quantidade: number; tipo: TipoMov }

// Cria o lote e, na sequência, lança as movimentações de estoque ligadas a ele.
// As movimentações vão num único insert (atômico). Se elas falharem, o lote é
// cancelado para não deixar registro solto.
async function criarLote(
  dados: { codigo: string; tipo: TipoLote; etapa: EtapaLote; quantidade_kg: number; bolsas: number | null; previsto_para: string },
  movs: Mov[],
  userId?: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('lote')
    .insert({ ...dados, criado_por: userId ?? null })
    .select('id')
    .single()
  if (error || !data) return error?.message ?? 'Falha ao criar o lote.'

  if (movs.length > 0) {
    const linhas = movs.map((m) => ({ ...m, lote_id: data.id, criado_por: userId ?? null }))
    const { error: e2 } = await supabase.from('estoque_movimentacao').insert(linhas)
    if (e2) {
      await supabase.from('lote').update({ cancelado_em: new Date().toISOString(), cancelado_por: userId ?? null }).eq('id', data.id)
      return 'Estoque insuficiente ou erro ao lançar consumo. O lote foi cancelado.'
    }
  }
  return null
}

export function criarLoteComposto(c: Config, kg: number, userId?: string) {
  return criarLote(
    { codigo: gerarCodigo('CMP'), tipo: 'composto', etapa: 'preparo', quantidade_kg: kg, bolsas: null, previsto_para: emDias(c.tempoPreparoComposto) },
    [], userId,
  )
}

export function criarLoteSpawn(c: Config, kg: number, userId?: string) {
  const sorgo = kg * c.sorgoSecoPorSpawn
  const cl = kg * (c.clNoSorgoPct / 100)
  const bolsas = c.pesoBolsaSpawnKg > 0 ? Math.round(kg / c.pesoBolsaSpawnKg) : null
  return criarLote(
    { codigo: gerarCodigo('SPW'), tipo: 'spawn', etapa: 'incubando', quantidade_kg: kg, bolsas, previsto_para: emDias(c.tempoSpawn) },
    [
      { item: 'sorgo_seco', quantidade: -sorgo, tipo: 'consumo' },
      { item: 'cl_f2', quantidade: -cl, tipo: 'consumo' },
    ],
    userId,
  )
}

export function criarLoteProducao(c: Config, kg: number, userId?: string) {
  const spawn = kg * (c.spawnNoSubstratoPct / 100)
  const bolsas = c.pesoBolsaSubstratoKg > 0 ? Math.round(kg / c.pesoBolsaSubstratoKg) : null
  return criarLote(
    { codigo: gerarCodigo('PRD'), tipo: 'producao', etapa: 'colonizando', quantidade_kg: kg, bolsas, previsto_para: emDias(c.tempoColonizacao) },
    [
      { item: 'substrato', quantidade: -kg, tipo: 'consumo' },
      { item: 'spawn', quantidade: -spawn, tipo: 'consumo' },
    ],
    userId,
  )
}

// Avança a etapa e atualiza o histórico (via gatilho). Alguns avanços produzem estoque.
async function avancar(id: number, campos: Partial<Lote>, userId?: string): Promise<string | null> {
  const { error } = await supabase
    .from('lote')
    .update({ ...campos, etapa_desde: new Date().toISOString(), criado_por: userId ?? null })
    .eq('id', id)
  return error?.message ?? null
}

// Composto/spawn prontos viram estoque.
export async function marcarPronto(l: Lote, userId?: string): Promise<string | null> {
  const erro = await avancar(l.id, { etapa: 'pronto', previsto_para: null }, userId)
  if (erro) return erro
  const item: ItemEstoque = l.tipo === 'spawn' ? 'spawn' : 'substrato'
  const { error } = await supabase.from('estoque_movimentacao').insert({
    item, quantidade: Number(l.quantidade_kg), tipo: 'producao', lote_id: l.id, criado_por: userId ?? null,
  })
  return error?.message ?? null
}

export function moverParaConteiner(l: Lote, conteiner: number, c: Config, userId?: string) {
  return avancar(l.id, { etapa: 'frutificando', conteiner, previsto_para: emDias(c.tempoFrutificacao) }, userId)
}

export function encerrarLote(l: Lote, userId?: string) {
  return avancar(l.id, { etapa: 'encerrado', previsto_para: null }, userId)
}

// Cancelar o lote também estorna (cancela) as movimentações que ele gerou.
export async function cancelarLote(l: Lote, userId?: string): Promise<string | null> {
  const { error } = await supabase
    .from('lote')
    .update({ cancelado_em: new Date().toISOString(), cancelado_por: userId ?? null })
    .eq('id', l.id).is('cancelado_em', null)
  if (error) return error.message
  await supabase
    .from('estoque_movimentacao')
    .update({ cancelado_em: new Date().toISOString(), cancelado_por: userId ?? null })
    .eq('lote_id', l.id).is('cancelado_em', null)
  return null
}

// Registra bolsas perdidas por contaminação num lote (acumulativo).
export async function registrarContaminacao(l: Lote, bolsas: number, userId?: string): Promise<string | null> {
  const novo = Number(l.bolsas_contaminadas ?? 0) + bolsas
  const { error } = await supabase
    .from('lote')
    .update({ bolsas_contaminadas: novo, criado_por: userId ?? null })
    .eq('id', l.id)
  return error?.message ?? null
}

// Sanidade agregada = bolsas sadias / bolsas inoculadas × 100, sobre os lotes
// de produção que já foram inoculados (colonizando em diante).
export function sanidadeAgregada(lotes: Lote[]): number | null {
  const inoculadas: EtapaLote[] = ['colonizando', 'frutificando', 'encerrado']
  let inoc = 0, cont = 0
  for (const l of lotes) {
    if (l.cancelado_em || l.tipo !== 'producao' || !inoculadas.includes(l.etapa)) continue
    inoc += Number(l.bolsas ?? 0)
    cont += Number(l.bolsas_contaminadas ?? 0)
  }
  if (inoc <= 0) return null
  return ((inoc - cont) / inoc) * 100
}
