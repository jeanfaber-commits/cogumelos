import type { Colheita } from './colheita'

export type PeriodoOpcao = '7' | '30' | '90' | 'tudo'

export const OPCOES_PERIODO: { id: PeriodoOpcao; label: string }[] = [
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '90', label: '90 dias' },
  { id: 'tudo', label: 'Tudo' },
]

const DIA = 86400000

function inicioDoDia(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ativas(colheitas: Colheita[]): Colheita[] {
  return colheitas.filter((c) => !c.cancelado_em)
}

// Início do período (null = desde sempre).
export function desdeDoPeriodo(op: PeriodoOpcao): Date | null {
  if (op === 'tudo') return null
  return inicioDoDia(new Date(Date.now() - (Number(op) - 1) * DIA))
}

function intervalo(colheitas: Colheita[], op: PeriodoOpcao): { inicio: Date; fim: Date } {
  const fim = inicioDoDia(new Date())
  const desde = desdeDoPeriodo(op)
  if (desde) return { inicio: desde, fim }
  // "Tudo": começa na colheita mais antiga.
  const datas = ativas(colheitas).map((c) => new Date(c.colhido_em).getTime())
  const inicio = datas.length ? inicioDoDia(new Date(Math.min(...datas))) : fim
  return { inicio, fim }
}

// Soma de colheita por dia, dentro do intervalo.
function somaPorDia(colheitas: Colheita[], inicio: Date, fim: Date): Map<string, number> {
  const mapa = new Map<string, number>()
  const ini = inicio.getTime(), f = fim.getTime() + DIA
  for (const c of ativas(colheitas)) {
    const t = new Date(c.colhido_em).getTime()
    if (t < ini || t >= f) continue
    const k = chaveDia(new Date(c.colhido_em))
    mapa.set(k, (mapa.get(k) ?? 0) + Number(c.peso_kg))
  }
  return mapa
}

export type Ponto = { label: string; valor: number }

// Série para o gráfico: barras por dia; se o período for longo, agrupa por semana.
export function serieProducao(colheitas: Colheita[], op: PeriodoOpcao): { pontos: Ponto[]; agrupamento: 'dia' | 'semana' } {
  const { inicio, fim } = intervalo(colheitas, op)
  const dias = Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1
  const porDia = somaPorDia(colheitas, inicio, fim)

  if (dias <= 45) {
    const pontos: Ponto[] = []
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicio.getTime() + i * DIA)
      pontos.push({ label: ddmm(d), valor: porDia.get(chaveDia(d)) ?? 0 })
    }
    return { pontos, agrupamento: 'dia' }
  }

  // Semanas (blocos de 7 dias a partir do início).
  const pontos: Ponto[] = []
  for (let i = 0; i < dias; i += 7) {
    const d0 = new Date(inicio.getTime() + i * DIA)
    let soma = 0
    for (let j = 0; j < 7 && i + j < dias; j++) {
      const d = new Date(d0.getTime() + j * DIA)
      soma += porDia.get(chaveDia(d)) ?? 0
    }
    pontos.push({ label: ddmm(d0), valor: soma })
  }
  return { pontos, agrupamento: 'semana' }
}

export type Resumo = { total: number; dias: number; mediaDia: number; melhorDia: number; n: number }

export function resumoPeriodo(colheitas: Colheita[], op: PeriodoOpcao): Resumo {
  const { inicio, fim } = intervalo(colheitas, op)
  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1)
  const porDia = somaPorDia(colheitas, inicio, fim)
  let total = 0, melhor = 0
  for (const v of porDia.values()) { total += v; if (v > melhor) melhor = v }
  const ini = inicio.getTime(), f = fim.getTime() + DIA
  const n = ativas(colheitas).filter((c) => {
    const t = new Date(c.colhido_em).getTime(); return t >= ini && t < f
  }).length
  return { total, dias, mediaDia: total / dias, melhorDia: melhor, n }
}

// CSV das colheitas do período (para exportar / abrir no Excel).
export function csvColheitas(colheitas: Colheita[], op: PeriodoOpcao): string {
  const { inicio, fim } = intervalo(colheitas, op)
  const ini = inicio.getTime(), f = fim.getTime() + DIA
  const linhas = ativas(colheitas)
    .filter((c) => { const t = new Date(c.colhido_em).getTime(); return t >= ini && t < f })
    .sort((a, b) => new Date(a.colhido_em).getTime() - new Date(b.colhido_em).getTime())
  const cab = 'data;hora;conteiner;turno;peso_kg'
  const corpo = linhas.map((c) => {
    const d = new Date(c.colhido_em)
    const data = d.toLocaleDateString('pt-BR')
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const turno = c.turno === 'manha' ? 'Manhã' : c.turno === 'tarde' ? 'Tarde' : ''
    const peso = String(Number(c.peso_kg)).replace('.', ',')
    return `${data};${hora};${c.conteiner};${turno};${peso}`
  })
  return [cab, ...corpo].join('\n')
}

// ---- Produção por turno no período (manhã vs tarde) ----
export type PorTurno = { manha: number; tarde: number; semTurno: number; total: number }
export function producaoPorTurno(colheitas: Colheita[], op: PeriodoOpcao): PorTurno {
  const desde = desdeDoPeriodo(op)
  const t0 = desde ? desde.getTime() : -Infinity
  let manha = 0, tarde = 0, semTurno = 0
  for (const c of ativas(colheitas)) {
    if (new Date(c.colhido_em).getTime() < t0) continue
    if (c.turno === 'manha') manha += Number(c.peso_kg)
    else if (c.turno === 'tarde') tarde += Number(c.peso_kg)
    else semTurno += Number(c.peso_kg)
  }
  return { manha, tarde, semTurno, total: manha + tarde + semTurno }
}

// ---- Produção acumulada a partir de uma série diária/semanal ----
export function acumular(pontos: Ponto[]): Ponto[] {
  let soma = 0
  return pontos.map((p) => { soma += p.valor; return { label: p.label, valor: soma } })
}

// ---- Produção por contêiner no período ----
export function producaoPorConteiner(colheitas: Colheita[], op: PeriodoOpcao): Ponto[] {
  const desde = desdeDoPeriodo(op)
  const t0 = desde ? desde.getTime() : -Infinity
  const mapa = new Map<number, number>()
  for (const c of ativas(colheitas)) {
    if (new Date(c.colhido_em).getTime() < t0) continue
    mapa.set(c.conteiner, (mapa.get(c.conteiner) ?? 0) + Number(c.peso_kg))
  }
  return Array.from(mapa.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, kg]) => ({ label: `Contêiner ${num}`, valor: kg }))
}

// ---- Contaminação por lote (cada lote com bolsas, em ordem de início) ----
// Binar por dia produziria muitos zeros (lotes não começam todo dia), então
// mostramos um ponto por lote: a % de bolsas contaminadas daquele lote.
import type { Lote, TipoLote } from './lotes'

export type ContamLote = { codigo: string; tipo: TipoLote; label: string; pct: number; contaminadas: number; bolsas: number }
export type ResumoContam = {
  pontos: Ponto[]; itens: ContamLote[]
  mediaPct: number; totalContaminadas: number; totalBolsas: number
  spawnPct: number | null; producaoPct: number | null
}

export function contaminacaoPorLote(lotes: Lote[], op: PeriodoOpcao): ResumoContam {
  const desde = desdeDoPeriodo(op)
  const t0 = desde ? desde.getTime() : -Infinity
  const relevantes = lotes
    .filter((l) => !l.cancelado_em && (l.bolsas ?? 0) > 0 && new Date(l.iniciado_em).getTime() >= t0)
    .sort((a, b) => new Date(a.iniciado_em).getTime() - new Date(b.iniciado_em).getTime())

  const itens: ContamLote[] = []
  let totalC = 0, totalB = 0, spawnC = 0, spawnB = 0, prodC = 0, prodB = 0
  for (const l of relevantes) {
    const b = Number(l.bolsas)
    const c = Number(l.bolsas_contaminadas ?? 0)
    itens.push({ codigo: l.codigo, tipo: l.tipo, label: ddmm(new Date(l.iniciado_em)), pct: b > 0 ? (c / b) * 100 : 0, contaminadas: c, bolsas: b })
    totalC += c; totalB += b
    if (l.tipo === 'spawn') { spawnC += c; spawnB += b }
    else if (l.tipo === 'producao') { prodC += c; prodB += b }
  }
  return {
    pontos: itens.map((i) => ({ label: i.label, valor: i.pct })),
    itens,
    mediaPct: totalB > 0 ? (totalC / totalB) * 100 : 0,
    totalContaminadas: totalC, totalBolsas: totalB,
    spawnPct: spawnB > 0 ? (spawnC / spawnB) * 100 : null,
    producaoPct: prodB > 0 ? (prodC / prodB) * 100 : null,
  }
}
