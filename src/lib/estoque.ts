import { supabase } from './supabase'

export type ItemEstoque = 'cl_f2' | 'sorgo_seco' | 'spawn' | 'substrato'

export const ITENS_ESTOQUE: { id: ItemEstoque; nome: string; unidade: string }[] = [
  { id: 'cl_f2', nome: 'Cultura líquida (CL F2)', unidade: 'kg' },
  { id: 'sorgo_seco', nome: 'Sorgo seco', unidade: 'kg' },
  { id: 'spawn', nome: 'Spawn de sorgo', unidade: 'kg' },
  { id: 'substrato', nome: 'Composto pronto', unidade: 'kg' },
]

export type TipoMov = 'producao' | 'compra' | 'consumo' | 'perda' | 'ajuste'

export const ROTULO_TIPO: Record<TipoMov, string> = {
  producao: 'Produção',
  compra: 'Entrada',
  consumo: 'Consumo',
  perda: 'Perda',
  ajuste: 'Ajuste',
}

export type Movimentacao = {
  id: number
  item: ItemEstoque
  quantidade: number // assinada: + entra, - sai
  tipo: TipoMov
  lote_id: number | null
  observacao: string | null
  criado_em: string
  cancelado_em: string | null
}

export function nomeItem(item: ItemEstoque): string {
  return ITENS_ESTOQUE.find((i) => i.id === item)?.nome ?? item
}

// Saldo de cada item = soma das quantidades das movimentações não canceladas.
export function calcularSaldos(movs: Movimentacao[]): Record<ItemEstoque, number> {
  const s: Record<ItemEstoque, number> = { cl_f2: 0, sorgo_seco: 0, spawn: 0, substrato: 0 }
  for (const m of movs) {
    if (m.cancelado_em) continue
    s[m.item] += Number(m.quantidade)
  }
  return s
}

export async function listarMovimentacoes(): Promise<Movimentacao[]> {
  const { data, error } = await supabase
    .from('estoque_movimentacao')
    .select('id,item,quantidade,tipo,lote_id,observacao,criado_em,cancelado_em')
    .order('criado_em', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return data as Movimentacao[]
}

type NovaMov = {
  item: ItemEstoque
  quantidade: number // já assinada
  tipo: TipoMov
  lote_id?: number | null
  observacao?: string | null
}

export async function registrarMovimentacao(m: NovaMov, userId?: string): Promise<string | null> {
  const { error } = await supabase.from('estoque_movimentacao').insert({
    item: m.item,
    quantidade: m.quantidade,
    tipo: m.tipo,
    lote_id: m.lote_id ?? null,
    observacao: m.observacao ?? null,
    criado_por: userId ?? null,
  })
  return error?.message ?? null
}

// Cancelar = marcar (nunca apagar). O saldo passa a ignorar a linha.
export async function cancelarMovimentacao(id: number, userId?: string): Promise<string | null> {
  const { error } = await supabase
    .from('estoque_movimentacao')
    .update({ cancelado_em: new Date().toISOString(), cancelado_por: userId ?? null })
    .eq('id', id)
    .is('cancelado_em', null)
  return error?.message ?? null
}
