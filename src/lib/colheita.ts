import { supabase } from './supabase'
import type { Config } from './calculos'
import type { Lote } from './lotes'

export type Turno = 'manha' | 'tarde'

export type Colheita = {
  id: number
  colhido_em: string
  conteiner: number
  peso_kg: number
  turno: Turno | null
  observacao: string | null
  cancelado_em: string | null
}

export const ROTULO_TURNO: Record<Turno, string> = { manha: 'Manhã', tarde: 'Tarde' }

export async function listarColheitas(): Promise<Colheita[]> {
  const { data, error } = await supabase
    .from('colheita')
    .select('id,colhido_em,conteiner,peso_kg,turno,observacao,cancelado_em')
    .order('colhido_em', { ascending: false })
    .limit(500)
  if (error || !data) return []
  return data as Colheita[]
}

type NovaColheita = { conteiner: number; peso_kg: number; turno?: Turno | null; observacao?: string | null; colhido_em?: string }

export async function registrarColheita(c: NovaColheita, userId?: string): Promise<string | null> {
  const { error } = await supabase.from('colheita').insert({
    conteiner: c.conteiner,
    peso_kg: c.peso_kg,
    turno: c.turno ?? null,
    observacao: c.observacao ?? null,
    colhido_em: c.colhido_em ?? new Date().toISOString(),
    criado_por: userId ?? null,
  })
  return error?.message ?? null
}

export async function cancelarColheita(id: number, userId?: string): Promise<string | null> {
  const { error } = await supabase
    .from('colheita')
    .update({ cancelado_em: new Date().toISOString(), cancelado_por: userId ?? null })
    .eq('id', id).is('cancelado_em', null)
  return error?.message ?? null
}

// Soma da colheita (kg) a partir de uma data, ignorando canceladas.
export function producaoNoPeriodo(colheitas: Colheita[], desde: Date): number {
  const t = desde.getTime()
  let total = 0
  for (const c of colheitas) {
    if (c.cancelado_em) continue
    if (new Date(c.colhido_em).getTime() >= t) total += Number(c.peso_kg)
  }
  return total
}

export function producaoTotal(colheitas: Colheita[]): number {
  let total = 0
  for (const c of colheitas) if (!c.cancelado_em) total += Number(c.peso_kg)
  return total
}

// Base de matéria seca: substrato que chegou (ou passou) pela frutificação.
// Substrato à umidade alvo -> matéria seca = peso × (1 - umidade/100).
function baseMateriaSecaKg(lotes: Lote[], c: Config): number {
  const fatorSeco = 1 - c.umidadeAlvoSubstratoPct / 100
  let seco = 0
  for (const l of lotes) {
    if (l.cancelado_em) continue
    if (l.tipo === 'producao' && (l.etapa === 'frutificando' || l.etapa === 'encerrado')) {
      seco += Number(l.quantidade_kg) * fatorSeco
    }
  }
  return seco
}

// Eficiência biológica agregada = colheita total / matéria seca × 100.
// É uma estimativa que estabiliza conforme os lotes completam o ciclo.
export function eficienciaBiologicaAgregada(colheitas: Colheita[], lotes: Lote[], c: Config): number | null {
  const seco = baseMateriaSecaKg(lotes, c)
  if (seco <= 0) return null
  return (producaoTotal(colheitas) / seco) * 100
}
