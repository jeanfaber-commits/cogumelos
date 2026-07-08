import type { Config } from './calculos'
import type { Lote } from './lotes'

const DIA = 86400000

// Mínimo de lotes concluídos para confiar na mediana e usá-la nos cálculos.
export const MIN_AMOSTRAS = 3

export type TempoReal = { mediana: number | null; amostras: number }
export type TemposReais = {
  colonizacao: TempoReal
  frutificacao: TempoReal
  spawn: TempoReal
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

const dias = (de: string, ate: string) => (new Date(ate).getTime() - new Date(de).getTime()) / DIA

// Calcula os tempos reais a partir do histórico dos lotes (marcos de data).
// - Colonização: do início até a ida ao contêiner (frutificacao_em).
// - Frutificação: da ida ao contêiner até o encerramento (encerrado_em).
// - Spawn: do início até ser marcado pronto (pronto_em).
export function calibrarTempos(lotes: Lote[]): TemposReais {
  const colon: number[] = []
  const frut: number[] = []
  const spawn: number[] = []
  for (const l of lotes) {
    if (l.cancelado_em) continue
    if (l.tipo === 'producao') {
      if (l.frutificacao_em) {
        const d = dias(l.iniciado_em, l.frutificacao_em)
        if (d > 0 && d < 200) colon.push(d)
      }
      if (l.frutificacao_em && l.encerrado_em) {
        const d = dias(l.frutificacao_em, l.encerrado_em)
        if (d > 0 && d < 400) frut.push(d)
      }
    } else if (l.tipo === 'spawn' && l.pronto_em) {
      const d = dias(l.iniciado_em, l.pronto_em)
      if (d > 0 && d < 200) spawn.push(d)
    }
  }
  return {
    colonizacao: { mediana: mediana(colon), amostras: colon.length },
    frutificacao: { mediana: mediana(frut), amostras: frut.length },
    spawn: { mediana: mediana(spawn), amostras: spawn.length },
  }
}

// Aplica os tempos reais na configuração (só quando há amostras suficientes).
// O resultado alimenta o teto e a projeção — o sistema aprende com o uso.
export function aplicarTempos(c: Config, t: TemposReais): Config {
  const usar = (real: TempoReal, padrao: number) =>
    real.amostras >= MIN_AMOSTRAS && real.mediana != null ? real.mediana : padrao
  return {
    ...c,
    tempoColonizacao: usar(t.colonizacao, c.tempoColonizacao),
    tempoFrutificacao: usar(t.frutificacao, c.tempoFrutificacao),
    tempoSpawn: usar(t.spawn, c.tempoSpawn),
  }
}
