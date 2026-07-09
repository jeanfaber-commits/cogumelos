import type { Config } from './calculos'
import { bolsasIniciais } from './lotes'
import type { Lote } from './lotes'
import type { Colheita } from './colheita'
import type { Ponto } from './indicadores'

const DIA = 86400000
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

export type PeriodoHist = '30' | '90' | '180'
export const OPCOES_HIST: { id: PeriodoHist; label: string }[] = [
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: '180', label: '180 dias' },
]

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : null)

// Marcos com retrocompatibilidade: lotes antigos (anteriores às colunas de
// marco) não têm as datas gravadas, então caímos para etapa_desde quando o lote
// já está naquela etapa.
const entrouNoConteiner = (l: Lote): number | null =>
  ms(l.frutificacao_em) ?? (l.etapa === 'frutificando' ? ms(l.etapa_desde) : null)

const saiuDoConteiner = (l: Lote): number | null =>
  ms(l.encerrado_em) ?? (l.etapa === 'encerrado' ? ms(l.etapa_desde) : null)

const spawnFicouPronto = (l: Lote): number | null =>
  ms(l.pronto_em) ?? (l.etapa === 'pronto' ? ms(l.etapa_desde) : null)

// Amostra ~30 pontos no período (um por dia em 30 dias; a cada N dias nos maiores).
function amostras(dias: number): { t: number; label: string }[] {
  const passo = Math.max(1, Math.round(dias / 30))
  const pontos: { t: number; label: string }[] = []
  for (let d = dias; d >= 0; d -= passo) {
    const data = new Date(Date.now() - d * DIA)
    pontos.push({ t: data.getTime(), label: ddmm(data) })
  }
  return pontos
}

// ---- Ocupação (lotação) do contêiner e da incubação ao longo do tempo, em % ----
// Reconstruída dos lotes: um lote ocupa o contêiner entre a entrada e a saída;
// ocupa a incubação entre o início e a entrada no contêiner (colonização) ou
// entre o início e ficar pronto (spawn).
export function serieOcupacao(lotes: Lote[], c: Config, dias: number): { conteiner: Ponto[]; incubacao: Ponto[] } {
  const capC = c.numeroConteineres * c.capacidadeConteinerKg
  const capI = c.numeroIncubadoras * c.capacidadeIncubacaoKg
  const pts = amostras(dias)
  const conteiner: Ponto[] = []
  const incubacao: Ponto[] = []

  for (const { t, label } of pts) {
    let kgC = 0
    let kgI = 0
    for (const l of lotes) {
      if (l.cancelado_em) continue
      const inicio = ms(l.iniciado_em)
      if (inicio == null || inicio > t) continue
      const kg = Number(l.quantidade_kg)

      if (l.tipo === 'producao') {
        const entrou = entrouNoConteiner(l)
        const saiu = saiuDoConteiner(l)
        // No contêiner: entrou <= t < saiu (ou ainda não saiu).
        if (entrou != null && entrou <= t && (saiu == null || saiu > t)) kgC += kg
        // Na incubação (colonizando): início <= t < entrada no contêiner.
        if (entrou == null || entrou > t) {
          if (l.etapa !== 'encerrado' || saiu == null || saiu > t) kgI += kg * c.fatorOcupacaoSubstrato
        }
      } else if (l.tipo === 'spawn') {
        const pronto = spawnFicouPronto(l)
        if (pronto == null || pronto > t) kgI += kg * c.fatorOcupacaoSpawn
      }
    }
    conteiner.push({ label, valor: capC > 0 ? (kgC / capC) * 100 : 0 })
    incubacao.push({ label, valor: capI > 0 ? (kgI / capI) * 100 : 0 })
  }
  return { conteiner, incubacao }
}

// ---- Eficiência biológica acumulada ao longo do tempo (%) ----
// Em cada data: colheita acumulada até ali / matéria seca que já entrou em
// frutificação até ali. É a mesma definição da EB agregada, vista no tempo.
export function serieEficienciaBiologica(colheitas: Colheita[], lotes: Lote[], c: Config, dias: number): Ponto[] {
  const fatorSeco = 1 - c.umidadeAlvoSubstratoPct / 100
  const pts = amostras(dias)
  const saida: Ponto[] = []
  for (const { t, label } of pts) {
    let colhido = 0
    for (const col of colheitas) {
      if (col.cancelado_em) continue
      const tc = ms(col.colhido_em)
      if (tc != null && tc <= t) colhido += Number(col.peso_kg)
    }
    let seco = 0
    for (const l of lotes) {
      if (l.cancelado_em || l.tipo !== 'producao') continue
      const entrou = entrouNoConteiner(l)
      if (entrou != null && entrou <= t) seco += Number(l.quantidade_kg) * fatorSeco
    }
    saida.push({ label, valor: seco > 0 ? (colhido / seco) * 100 : 0 })
  }
  return saida
}

// ---- Sanidade acumulada ao longo do tempo (%) ----
// bolsas sadias / bolsas inoculadas, considerando os lotes já iniciados até cada
// data. Entram os lotes de spawn (incubação) e de produção (colonização e
// frutificação). A base é a quantidade inicial de bolsas — o saldo do lote já
// vem abatido das perdas.
export function serieSanidade(lotes: Lote[], dias: number): Ponto[] {
  const pts = amostras(dias)
  return pts.map(({ t, label }) => {
    let inoc = 0
    let cont = 0
    for (const l of lotes) {
      if (l.cancelado_em || l.tipo === 'composto' || l.etapa === 'preparo') continue
      const inicio = ms(l.iniciado_em)
      if (inicio == null || inicio > t) continue
      inoc += bolsasIniciais(l)
      cont += Number(l.bolsas_contaminadas ?? 0)
    }
    return { label, valor: inoc > 0 ? ((inoc - cont) / inoc) * 100 : 0 }
  })
}
