import { supabase } from './supabase'

export type EtapaContaminacao = 'spawn' | 'colonizacao' | 'frutificacao'
export type CausaContaminacao = 'spawn' | 'pasteurizacao' | 'manuseio' | 'ambiente' | 'desconhecida' | 'outro'

export type Contaminacao = {
  id: number
  lote_id: number
  quantidade: number
  etapa: EtapaContaminacao
  causa: CausaContaminacao
  observacao: string | null
  criado_em: string
  cancelado_em: string | null
}

export const ROTULO_CAUSA: Record<CausaContaminacao, string> = {
  spawn: 'Spawn / cultura',
  pasteurizacao: 'Pasteurização',
  manuseio: 'Manuseio',
  ambiente: 'Ambiente',
  desconhecida: 'Desconhecida',
  outro: 'Outro',
}
export const rotuloCausa = (c: CausaContaminacao) => ROTULO_CAUSA[c]

export const ROTULO_ETAPA_CONT: Record<EtapaContaminacao, string> = {
  spawn: 'Spawn',
  colonizacao: 'Colonização',
  frutificacao: 'Frutificação',
}
export const rotuloEtapaCont = (e: EtapaContaminacao) => ROTULO_ETAPA_CONT[e]

// Ordem das opções de causa mostradas no formulário.
export const CAUSAS: CausaContaminacao[] = ['spawn', 'pasteurizacao', 'manuseio', 'ambiente', 'desconhecida', 'outro']

export async function listarContaminacoes(): Promise<Contaminacao[]> {
  const { data, error } = await supabase
    .from('contaminacao')
    .select('id,lote_id,quantidade,etapa,causa,observacao,criado_em,cancelado_em')
    .order('criado_em', { ascending: false })
    .limit(1000)
  if (error || !data) return []
  return data as Contaminacao[]
}
