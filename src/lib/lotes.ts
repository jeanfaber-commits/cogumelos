import { supabase } from './supabase'
import type { Config } from './calculos'
import type { ItemEstoque, TipoMov } from './estoque'
import type { CausaContaminacao, EtapaContaminacao } from './contaminacao'

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
  pronto_em: string | null
  frutificacao_em: string | null
  encerrado_em: string | null
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
const DIA = 86400000
function emDias(n: number): string {
  return new Date(Date.now() + n * DIA).toISOString()
}
// previsto_para a partir de uma data-base (para lotes com data retroativa).
function emDiasDe(base: string, n: number): string {
  return new Date(new Date(base).getTime() + n * DIA).toISOString()
}
const PREFIXO: Record<TipoLote, string> = { spawn: 'SW', composto: 'SO', producao: 'PR' }

// Gera o código do lote no formato PREFIXO-AAMMDD, com sufixo sequencial se já
// houver outro lote do mesmo tipo no mesmo dia (ex.: SW-260707, SW-260707-2).
// dataRef permite gerar o código de um lote com data retroativa.
// Só conta como sequência do dia os sufixos numéricos (ex.: -2), para que
// códigos de divisão parcial (ex.: -P1) não inflem a contagem.
export function gerarCodigoLote(tipo: TipoLote, lotes: Lote[], dataRef?: Date): string {
  const d = dataRef ?? new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  const base = `${PREFIXO[tipo]}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`
  const n = lotes.filter((l) => l.codigo === base || /^-\d+$/.test(l.codigo.slice(base.length))).length
  return n === 0 ? base : `${base}-${n + 1}`
}

export async function listarLotes(): Promise<Lote[]> {
  const { data, error } = await supabase
    .from('lote')
    .select('id,codigo,tipo,etapa,quantidade_kg,bolsas,bolsas_contaminadas,conteiner,iniciado_em,etapa_desde,previsto_para,pronto_em,frutificacao_em,encerrado_em,observacao,cancelado_em')
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
  iniciadoEm?: string,
): Promise<string | null> {
  const extra = iniciadoEm ? { iniciado_em: iniciadoEm, etapa_desde: iniciadoEm } : {}
  const { data, error } = await supabase
    .from('lote')
    .insert({ ...dados, ...extra, criado_por: userId ?? null })
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

export function criarLoteComposto(c: Config, kg: number, codigo: string, userId?: string, iniciadoEm?: Date) {
  const base = iniciadoEm?.toISOString()
  const previsto = base ? emDiasDe(base, c.tempoPreparoComposto) : emDias(c.tempoPreparoComposto)
  return criarLote(
    { codigo, tipo: 'composto', etapa: 'preparo', quantidade_kg: kg, bolsas: null, previsto_para: previsto },
    [], userId, base,
  )
}

export function criarLoteSpawn(c: Config, kg: number, bolsas: number | null, codigo: string, userId?: string, iniciadoEm?: Date) {
  const sorgo = kg * c.sorgoSecoPorSpawn
  const clMl = kg * (c.clNoSorgoPct / 100) * 1000 // CL em mL (densidade 1 L = 1 kg)
  const base = iniciadoEm?.toISOString()
  const previsto = base ? emDiasDe(base, c.tempoSpawn) : emDias(c.tempoSpawn)
  return criarLote(
    { codigo, tipo: 'spawn', etapa: 'incubando', quantidade_kg: kg, bolsas, previsto_para: previsto },
    [
      { item: 'sorgo_seco', quantidade: -sorgo, tipo: 'consumo' },
      { item: 'cl_f2', quantidade: -clMl, tipo: 'consumo' },
    ],
    userId, base,
  )
}

export function criarLoteProducao(c: Config, kg: number, bolsas: number | null, codigo: string, userId?: string, iniciadoEm?: Date) {
  const spawn = kg * (c.spawnNoSubstratoPct / 100)
  const base = iniciadoEm?.toISOString()
  const previsto = base ? emDiasDe(base, c.tempoColonizacao) : emDias(c.tempoColonizacao)
  return criarLote(
    { codigo, tipo: 'producao', etapa: 'colonizando', quantidade_kg: kg, bolsas, previsto_para: previsto },
    [
      { item: 'substrato', quantidade: -kg, tipo: 'consumo' },
      { item: 'spawn', quantidade: -spawn, tipo: 'consumo' },
    ],
    userId, base,
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
  const erro = await avancar(l.id, { etapa: 'pronto', previsto_para: null, pronto_em: new Date().toISOString() }, userId)
  if (erro) return erro
  const item: ItemEstoque = l.tipo === 'spawn' ? 'spawn' : 'substrato'
  const { error } = await supabase.from('estoque_movimentacao').insert({
    item, quantidade: Number(l.quantidade_kg), tipo: 'producao', lote_id: l.id, criado_por: userId ?? null,
  })
  return error?.message ?? null
}

// Código de um lote-filho de divisão parcial (ex.: PR-260707-P1, -P2).
export function codigoParcial(base: string, lotes: Lote[]): string {
  const n = lotes.filter((l) => l.codigo.startsWith(base + '-P')).length
  return `${base}-P${n + 1}`
}

// Move o lote (colonizando) para o contêiner (frutificando). Se bolsasMover for
// menor que o total, divide o lote: a parte movida vira um lote-filho já
// frutificando e o restante continua colonizando (lotes nem sempre são
// homogêneos). codigoFilho é calculado por quem chama (tem a lista de lotes).
export async function moverParaConteiner(
  l: Lote, conteiner: number, c: Config, userId?: string, bolsasMover?: number | null, codigoFilho?: string,
): Promise<string | null> {
  const agora = new Date().toISOString()
  const total = Number(l.bolsas ?? 0)
  const mover = bolsasMover == null ? total : Math.min(Math.max(0, Math.round(bolsasMover)), total)

  // Move tudo (ou lote sem contagem de bolsas): apenas avança a etapa.
  if (total <= 0 || mover >= total) {
    return avancar(l.id, { etapa: 'frutificando', conteiner, previsto_para: emDias(c.tempoFrutificacao), frutificacao_em: agora }, userId)
  }
  if (mover <= 0) return null

  // Move parte: divide o lote.
  const kgMover = Number(l.quantidade_kg) * (mover / total)
  const kgResta = Number(l.quantidade_kg) - kgMover
  const bolsasResta = total - mover

  // 1) reduz o lote pai (continua colonizando; datas preservadas).
  const { error: e1 } = await supabase.from('lote')
    .update({ quantidade_kg: kgResta, bolsas: bolsasResta, criado_por: userId ?? null })
    .eq('id', l.id)
  if (e1) return e1.message

  // 2) cria o lote-filho já frutificando, herdando iniciado_em (para calibrar a colonização).
  const { error: e2 } = await supabase.from('lote').insert({
    codigo: codigoFilho ?? `${l.codigo}-P`,
    tipo: 'producao', etapa: 'frutificando',
    quantidade_kg: kgMover, bolsas: mover, bolsas_contaminadas: 0, conteiner,
    iniciado_em: l.iniciado_em, etapa_desde: agora, frutificacao_em: agora,
    previsto_para: emDias(c.tempoFrutificacao), criado_por: userId ?? null,
  })
  if (e2) {
    // desfaz a redução do pai para não sumir com bolsas.
    await supabase.from('lote').update({ quantidade_kg: Number(l.quantidade_kg), bolsas: total }).eq('id', l.id)
    return e2.message
  }
  return null
}

export function encerrarLote(l: Lote, userId?: string) {
  return avancar(l.id, { etapa: 'encerrado', previsto_para: null, encerrado_em: new Date().toISOString() }, userId)
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

// Registra bolsas perdidas por contaminação: grava um evento (etapa + causa,
// para análise de causa-raiz) e soma no total do lote (para a sanidade).
// A etapa é inferida da etapa atual do lote.
export async function registrarContaminacao(
  l: Lote, bolsas: number, causa: CausaContaminacao, userId?: string,
): Promise<string | null> {
  const etapa: EtapaContaminacao =
    l.etapa === 'frutificando' ? 'frutificacao' : l.etapa === 'incubando' ? 'spawn' : 'colonizacao'
  const { error: e1 } = await supabase.from('contaminacao').insert({
    lote_id: l.id, quantidade: bolsas, etapa, causa, criado_por: userId ?? null,
  })
  if (e1) return e1.message
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
