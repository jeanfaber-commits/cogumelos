import { useRef, useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import BarChart from '../components/BarChart'
import { baixarPng, baixarPdf } from '../lib/exportar'
import {
  OPCOES_PERIODO, serieProducao, resumoPeriodo, csvColheitas, type PeriodoOpcao,
} from '../lib/indicadores'

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export default function Indicadores() {
  const { config } = useConfig()
  const { colheitas, eficienciaBiologica, sanidade, carregando } = useDados()
  const [periodo, setPeriodo] = useState<PeriodoOpcao>('30')
  const chartRef = useRef<HTMLDivElement>(null)

  const { pontos, agrupamento } = serieProducao(colheitas, periodo)
  const r = resumoPeriodo(colheitas, periodo)

  const baixarCSV = () => {
    const csv = csvColheitas(colheitas, periodo)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `colheitas-${periodo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rotuloPeriodo = OPCOES_PERIODO.find((o) => o.id === periodo)?.label ?? ''
  const exportarGrafico = async (tipo: 'png' | 'pdf') => {
    const svg = chartRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    const nome = `producao-${periodo}`
    if (tipo === 'png') await baixarPng(svg, nome)
    else await baixarPdf(svg, nome, `Produção colhida — ${rotuloPeriodo}`)
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Indicadores</h1>
        <p className="page-desc">Produção ao longo do tempo e desempenho da operação.</p>
      </div>

      <div className="seg tabs-bar">
        {OPCOES_PERIODO.map((o) => (
          <button key={o.id} className={periodo === o.id ? 'on' : ''} onClick={() => setPeriodo(o.id)}>{o.label}</button>
        ))}
      </div>

      {/* Gráfico de produção */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Produção colhida</div>
        <div className="section-sub">kg {agrupamento === 'semana' ? 'por semana' : 'por dia'}</div>
        <div ref={chartRef}>
          {carregando ? <div className="empty-note">Carregando…</div> : <BarChart pontos={pontos} unidade="kg" />}
        </div>
        <div className="export-bar">
          <span>Exportar:</span>
          <button className="btn btn-ghost" disabled={colheitas.length === 0} onClick={() => exportarGrafico('png')}>PNG</button>
          <button className="btn btn-ghost" disabled={colheitas.length === 0} onClick={() => exportarGrafico('pdf')}>PDF</button>
          <button className="btn btn-ghost" disabled={colheitas.length === 0} onClick={baixarCSV}>CSV</button>
        </div>
      </div>

      {/* Resumo do período */}
      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Total no período</div>
          <div className="metric-value tnum">{fmt(r.total, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">{r.n} colheitas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Média por dia</div>
          <div className="metric-value tnum">{fmt(r.mediaDia, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">{r.dias} dias</div>
        </div>
        <div className="metric">
          <div className="metric-label">Melhor dia</div>
          <div className="metric-value tnum">{fmt(r.melhorDia, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">pico de colheita</div>
        </div>
        <div className="metric">
          <div className="metric-label">Colheitas</div>
          <div className="metric-value tnum">{r.n}</div>
          <div className="metric-foot">registros no período</div>
        </div>
      </div>

      {/* Indicadores acumulados */}
      <div className="grid grid-metrics">
        <div className="metric">
          <div className="metric-label">Eficiência biológica</div>
          <div className={`metric-value tnum ${eficienciaBiologica == null ? 'empty' : ''}`}>
            {eficienciaBiologica == null ? '—' : fmt(eficienciaBiologica, 0)}
            {eficienciaBiologica != null && <span className="metric-unit">%</span>}
          </div>
          <div className="metric-foot">acumulada · meta {config.beAlvoPct}%</div>
        </div>
        <div className="metric">
          <div className="metric-label">Sanidade</div>
          <div className={`metric-value tnum ${sanidade == null ? 'empty' : ''}`}>
            {sanidade == null ? '—' : fmt(sanidade, 0)}
            {sanidade != null && <span className="metric-unit">%</span>}
          </div>
          <div className="metric-foot">bolsas sem contaminação</div>
        </div>
      </div>

      <div className="empty-note" style={{ marginTop: 14 }}>
        A eficiência biológica e a sanidade são acumuladas de toda a operação. Gráficos de
        ocupação e de eficiência ao longo do tempo entram junto com o Assistente, que usa o
        histórico dos lotes.
      </div>
    </>
  )
}
