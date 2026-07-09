import { supabase } from './supabase'
import type { EtapaContaminacao } from './contaminacao'

// Reaproveita as mesmas etapas da contaminação (spawn / colonização / frutificação).
export type EtapaDescarte = EtapaContaminacao
export type MotivoDescarte = 'ma_colonizacao' | 'crescimento_lento' | 'dano_fisico' | 'outro'

export type Descarte = {
  id: number
  lote_id: number
  quantidade: number
  etapa: EtapaDescarte
  motivo: MotivoDescarte
  observacao: string | null
  criado_em: string
  cancelado_em: string | null
}

export const ROTULO_MOTIVO: Record<MotivoDescarte, string> = {
  ma_colonizacao: 'Má colonização',
  crescimento_lento: 'Crescimento lento',
  dano_fisico: 'Dano físico',
  outro: 'Outro',
}
export const rotuloMotivo = (m: MotivoDescarte) => ROTULO_MOTIVO[m]

// Ordem das opções mostradas no formulário.
export const MOTIVOS: MotivoDescarte[] = ['ma_colonizacao', 'crescimento_lento', 'dano_fisico', 'outro']

export async function listarDescartes(): Promise<Descarte[]> {
  const { data, error } = await supabase
    .from('descarte')
    .select('id,lote_id,quantidade,etapa,motivo,observacao,criado_em,cancelado_em')
    .order('criado_em', { ascending: false })
    .limit(1000)
  if (error || !data) return []
  return data as Descarte[]
}
