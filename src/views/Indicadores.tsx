import { useRef, useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import BarChart from '../components/BarChart'
import LineChart from '../components/LineChart'
import ChartFrame from '../components/ChartFrame'
import { baixarPng, baixarPdf } from '../lib/exportar'
import {
  OPCOES_PERIODO, serieProducao, resumoPeriodo, csvColheitas, acumular,
  producaoPorTurno, producaoPorConteiner, contaminacaoPorLote,
  spcContaminacao, paretoContaminacao, type PeriodoOpcao,
} from '../lib/indicadores'
import {
  OPCOES_HIST, serieOcupacao, serieEficienciaBiologica, serieSanidade, type PeriodoHist,
} from '../lib/historico'
import { rotuloCausa } from '../lib/contaminacao'
import { MIN_AMOSTRAS } from '../lib/calibracao'
import { IconDownload } from '../icons'

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export default function Indicadores() {
  const { config } = useConfig()
  const { colheitas, lotes, eficienciaBiologica, sanidade, carregando, teto, temposReais, contaminacoes } = useDados()
  const [periodo, setPeriodo] = useState<PeriodoOpcao>('30')
  const [hist, setHist] = useState<PeriodoHist>('90')
  const [modo, setModo] = useState<'barras' | 'acumulado'>('barras')
  const [exportando, setExportando] = useState(false)
  const [selecao, setSelecao] = useState<string[]>([])

  // Cada gráfico se registra aqui para poder ser exportado por seleção.
  const refs = useRef<Record<string, HTMLDivElement | null>>({})
  const reg = (id: string) => (el: HTMLDivElement | null) => { refs.current[id] = el }

  const { pontos, agrupamento } = serieProducao(colheitas, periodo)
  const acumulado = acumular(pontos)
  const r = resumoPeriodo(colheitas, periodo)
  const porTurno = producaoPorTurno(colheitas, periodo)
  const porConteiner = producaoPorConteiner(colheitas, periodo)
  const contam = contaminacaoPorLote(lotes, periodo)
  const spc = spcContaminacao(lotes, periodo)
  const pareto = paretoContaminacao(contaminacoes, periodo)

  const diasHist = Number(hist)
  const ocup = serieOcupacao(lotes, config, diasHist)
  const ebHist = serieEficienciaBiologica(colheitas, lotes, config, diasHist)
  const sanHist = serieSanidade(lotes, diasHist)

  const temTurno = porTurno.manha > 0 || porTurno.tarde > 0
  const aproveitamento = teto.producaoPrevistaDia > 0 ? (r.mediaDia / teto.producaoPrevistaDia) * 100 : null
  const rotuloPeriodo = OPCOES_PERIODO.find((o) => o.id === periodo)?.label ?? ''

  // Catálogo dos gráficos disponíveis agora (alimenta o painel de exportação).
  const disponiveis: { id: string; titulo: string }[] = [
    { id: 'producao', titulo: `Produção ${modo === 'acumulado' ? 'acumulada' : 'colhida'} — ${rotuloPeriodo}` },
    { id: 'ocupacao', titulo: `Lotação do contêiner e da incubação — ${hist} dias` },
    { id: 'eb', titulo: `Eficiência biológica — ${hist} dias` },
    { id: 'sanidade', titulo: `Sanidade — ${hist} dias` },
    ...(porConteiner.length > 1 ? [{ id: 'conteiner', titulo: `Produção por contêiner — ${rotuloPeriodo}` }] : []),
    ...(contam.totalBolsas > 0 ? [{ id: 'contaminacao', titulo: `Contaminação por lote — ${rotuloPeriodo}` }] : []),
    ...(spc.n >= 2 ? [{ id: 'spc', titulo: `Controle estatístico da contaminação — ${rotuloPeriodo}` }] : []),
    ...(pareto.total > 0 ? [{ id: 'pareto', titulo: `Causa-raiz da contaminação — ${rotuloPeriodo}` }] : []),
  ]

  const alternar = (id: string) =>
    setSelecao((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const todos = () => setSelecao(selecao.length === disponiveis.length ? [] : disponiveis.map((g) => g.id))

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

  const exportarSelecionados = async (tipo: 'png' | 'pdf') => {
    for (const id of selecao) {
      const g = disponiveis.find((x) => x.id === id)
      const svg = refs.current[id]?.querySelector('svg[role="img"]') as SVGSVGElement | null
      if (!svg || !g) continue
      if (tipo === 'png') await baixarPng(svg, `${id}-${periodo}`)
      else await baixarPdf(svg, `${id}-${periodo}`, g.titulo)
    }
    setExportando(false)
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Indicadores</h1>
        <p className="page-desc">Produção ao longo do tempo e desempenho da operação.</p>
      </div>

      <div className="acoes-topo">
        <div className="seg tabs-bar" style={{ flex: 1 }}>
          {OPCOES_PERIODO.map((o) => (
            <button key={o.id} className={periodo === o.id ? 'on' : ''} onClick={() => setPeriodo(o.id)}>{o.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost exportar-btn" onClick={() => setExportando((v) => !v)}>
          <IconDownload size={16} /> Exportar
        </button>
      </div>

      {/* Painel de exportação: escolha quais indicadores sair */}
      {exportando && (
        <div className="card export-panel">
          <div className="section-title" style={{ marginBottom: 2 }}>Exportar indicadores</div>
          <div className="section-sub">Escolha quais gráficos exportar. Cada um vira um arquivo.</div>
          <div className="export-lista">
            {disponiveis.map((g) => (
              <label key={g.id} className="export-item">
                <input type="checkbox" checked={selecao.includes(g.id)} onChange={() => alternar(g.id)} />
                <span>{g.titulo}</span>
              </label>
            ))}
          </div>
          <div className="export-bar" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost" onClick={todos}>
              {selecao.length === disponiveis.length ? 'Limpar' : 'Selecionar todos'}
            </button>
            <button className="btn btn-primary" disabled={selecao.length === 0} onClick={() => exportarSelecionados('png')}>PNG</button>
            <button className="btn btn-primary" disabled={selecao.length === 0} onClick={() => exportarSelecionados('pdf')}>PDF</button>
            <button className="btn btn-ghost" disabled={colheitas.length === 0} onClick={baixarCSV}>CSV das colheitas</button>
          </div>
        </div>
      )}

      {/* Gráfico de produção */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div className="section-title" style={{ marginBottom: 2 }}>Produção colhida</div>
            <div className="section-sub">
              {modo === 'acumulado' ? 'kg acumulados no período' : `kg ${agrupamento === 'semana' ? 'por semana' : 'por dia'}`}
            </div>
          </div>
          <div className="seg">
            <button className={modo === 'barras' ? 'on' : ''} onClick={() => setModo('barras')}>Barras</button>
            <button className={modo === 'acumulado' ? 'on' : ''} onClick={() => setModo('acumulado')}>Acumulado</button>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div ref={reg('producao')}>
            <ChartFrame titulo="Produção colhida">
              {carregando ? <div className="empty-note">Carregando…</div>
                : modo === 'acumulado' ? <LineChart pontos={acumulado} unidade="kg" />
                : <BarChart pontos={pontos} unidade="kg" />}
            </ChartFrame>
          </div>
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
          <div className="metric-label">Aproveitamento do teto</div>
          <div className={`metric-value tnum ${aproveitamento == null ? 'empty' : ''}`}>
            {aproveitamento == null ? '—' : fmt(aproveitamento, 0)}
            {aproveitamento != null && <span className="metric-unit">%</span>}
          </div>
          <div className="metric-foot">média/dia vs teto {fmt(teto.producaoPrevistaDia, 0)} kg</div>
        </div>
      </div>

      {/* Seletor do histórico */}
      <div className="seg tabs-bar" style={{ marginBottom: 12 }}>
        {OPCOES_HIST.map((o) => (
          <button key={o.id} className={hist === o.id ? 'on' : ''} onClick={() => setHist(o.id)}>{o.label}</button>
        ))}
      </div>

      {/* Lotação histórica — contêiner e incubação */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Lotação (histórico)</div>
        <div className="section-sub">% da capacidade ocupada no contêiner e na sala de incubação, reconstruída dos lotes.</div>
        <div style={{ marginTop: 10 }}>
          <div ref={reg('ocupacao')}>
            <ChartFrame titulo="Lotação do contêiner e da incubação">
              <LineChart unidade="%" rotulosValores={false}
                referencia={{ valor: teto.tetoPct, label: `teto ${fmt(teto.tetoPct, 0)}%` }}
                series={[
                  { nome: 'Contêiner', pontos: ocup.conteiner, cor: 'var(--accent)' },
                  { nome: 'Sala de incubação', pontos: ocup.incubacao, cor: '#3a9ad9' },
                ]} />
            </ChartFrame>
          </div>
        </div>
      </div>

      {/* Eficiência biológica histórica */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Eficiência biológica (histórico)</div>
        <div className="section-sub">EB acumulada em cada data: colheita até ali ÷ matéria seca que já entrou em frutificação.</div>
        <div style={{ marginTop: 10 }}>
          <div ref={reg('eb')}>
            <ChartFrame titulo="Eficiência biológica">
              <LineChart pontos={ebHist} unidade="%" rotulosValores={false}
                referencia={{ valor: config.beAlvoPct, label: `meta ${config.beAlvoPct}%` }} />
            </ChartFrame>
          </div>
        </div>
      </div>

      {/* Sanidade histórica */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Sanidade (histórico)</div>
        <div className="section-sub">% de bolsas sadias considerando os lotes já iniciados em cada data.</div>
        <div style={{ marginTop: 10 }}>
          <div ref={reg('sanidade')}>
            <ChartFrame titulo="Sanidade">
              <LineChart pontos={sanHist} unidade="%" rotulosValores={false}
                referencia={{ valor: 100 - config.contaminacaoColonizacaoPct, label: `meta ${100 - config.contaminacaoColonizacaoPct}%` }} />
            </ChartFrame>
          </div>
        </div>
      </div>

      {/* Produção por turno */}
      {temTurno && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 2 }}>Produção por turno</div>
          <div className="section-sub">Quanto vem de cada colheita do dia.</div>
          <div className="grid grid-metrics" style={{ marginTop: 8 }}>
            <div className="metric">
              <div className="metric-label">Manhã</div>
              <div className="metric-value tnum">{fmt(porTurno.manha, 1)}<span className="metric-unit">kg</span></div>
              <div className="metric-foot">{porTurno.total > 0 ? fmt((porTurno.manha / porTurno.total) * 100, 0) : '0'}% do total</div>
            </div>
            <div className="metric">
              <div className="metric-label">Tarde</div>
              <div className="metric-value tnum">{fmt(porTurno.tarde, 1)}<span className="metric-unit">kg</span></div>
              <div className="metric-foot">{porTurno.total > 0 ? fmt((porTurno.tarde / porTurno.total) * 100, 0) : '0'}% do total</div>
            </div>
          </div>
        </div>
      )}

      {/* Produção por contêiner */}
      {porConteiner.length > 1 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 2 }}>Produção por contêiner</div>
          <div className="section-sub">Total colhido em cada contêiner no período.</div>
          <div style={{ marginTop: 10 }}>
            <div ref={reg('conteiner')}>
              <ChartFrame titulo="Produção por contêiner"><BarChart pontos={porConteiner} unidade="kg" /></ChartFrame>
            </div>
          </div>
        </div>
      )}

      {/* Contaminação por lote ao longo do tempo */}
      {contam.totalBolsas > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 2 }}>Contaminação por lote</div>
          <div className="section-sub">% de bolsas contaminadas em cada lote, em ordem de início.</div>
          <div style={{ marginTop: 10 }}>
            <div ref={reg('contaminacao')}>
              <ChartFrame titulo="Contaminação por lote"><BarChart pontos={contam.pontos} unidade="%" /></ChartFrame>
            </div>
          </div>
          <div className="grid grid-metrics" style={{ marginTop: 12 }}>
            <div className="metric">
              <div className="metric-label">Média do período</div>
              <div className="metric-value tnum">{fmt(contam.mediaPct, 1)}<span className="metric-unit">%</span></div>
              <div className="metric-foot">{contam.totalContaminadas} de {contam.totalBolsas} bolsas</div>
            </div>
            <div className="metric">
              <div className="metric-label">Spawn</div>
              <div className={`metric-value tnum ${contam.spawnPct == null ? 'empty' : ''}`}>
                {contam.spawnPct == null ? '—' : fmt(contam.spawnPct, 1)}
                {contam.spawnPct != null && <span className="metric-unit">%</span>}
              </div>
              <div className="metric-foot">nos lotes de spawn · alvo {config.contaminacaoSpawnPct}%</div>
            </div>
            <div className="metric">
              <div className="metric-label">Produção</div>
              <div className={`metric-value tnum ${contam.producaoPct == null ? 'empty' : ''}`}>
                {contam.producaoPct == null ? '—' : fmt(contam.producaoPct, 1)}
                {contam.producaoPct != null && <span className="metric-unit">%</span>}
              </div>
              <div className="metric-foot">na colonização · alvo {config.contaminacaoColonizacaoPct}%</div>
            </div>
          </div>
        </div>
      )}

      {/* SPC — carta de controle (p) da contaminação */}
      {spc.n >= 2 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 2 }}>Controle estatístico (contaminação)</div>
          <div className="section-sub">Carta p: linha central é a média; a tracejada é o limite de 3σ (varia com o tamanho do lote). Pontos acima do limite têm causa especial.</div>
          <div style={{ marginTop: 10 }}>
            <div ref={reg('spc')}>
              <ChartFrame titulo="Controle estatístico da contaminação">
                <LineChart unidade="%" series={[
                  { nome: 'contaminação %', pontos: spc.pontos, cor: 'var(--accent)' },
                  { nome: 'limite 3σ', pontos: spc.ucl, cor: 'var(--danger)', tracejado: true },
                  { nome: 'média', pontos: spc.pontos.map((p) => ({ label: p.label, valor: spc.centro })), cor: 'var(--text-muted)', tracejado: true },
                ]} />
              </ChartFrame>
            </div>
          </div>
          {spc.fora.length > 0 ? (
            <div className="assist-prep" style={{ marginTop: 8 }}>
              <b>{spc.fora.length} lote(s) acima do limite</b> — investigar: {spc.fora.map((f) => `${f.codigo} (${fmt(f.pct, 1)}%)`).join(', ')}.
            </div>
          ) : (
            <div className="help" style={{ marginTop: 8 }}>Nenhum lote fora de controle no período — processo estável.</div>
          )}
        </div>
      )}

      {/* Causa-raiz — Pareto das causas de contaminação */}
      {pareto.total > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 2 }}>Causa-raiz da contaminação</div>
          <div className="section-sub">Bolsas perdidas por causa registrada, da maior para a menor (Pareto).</div>
          <div style={{ marginTop: 10 }}>
            <div ref={reg('pareto')}>
              <ChartFrame titulo="Causa-raiz da contaminação">
                <BarChart pontos={pareto.itens.map((i) => ({ label: rotuloCausa(i.causa), valor: i.quantidade }))} unidade="bolsas" />
              </ChartFrame>
            </div>
          </div>
          <div className="pareto-list">
            {pareto.itens.map((i) => (
              <div className="pareto-row" key={i.causa}>
                <span>{rotuloCausa(i.causa)}</span>
                <span className="tnum">{i.quantidade} · {fmt(i.pct, 0)}% <small>(acum. {fmt(i.acumuladoPct, 0)}%)</small></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tempos calibrados — o app aprende os tempos reais com o uso */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Tempos reais (calibração)</div>
        <div className="section-sub">Medianas medidas nos lotes concluídos. Com {MIN_AMOSTRAS}+ amostras, passam a alimentar o teto e a projeção no lugar do valor configurado.</div>
        <div className="calib-list">
          {([
            ['Colonização', temposReais.colonizacao, config.tempoColonizacao],
            ['Frutificação', temposReais.frutificacao, config.tempoFrutificacao],
            ['Spawn', temposReais.spawn, config.tempoSpawn],
          ] as const).map(([nome, real, padrao]) => {
            const aplicando = real.amostras >= MIN_AMOSTRAS && real.mediana != null
            return (
              <div className="calib-row" key={nome}>
                <span className="calib-nome">{nome}</span>
                <span className="tnum">
                  {real.mediana == null ? '—' : `${fmt(real.mediana, 1)} d`}
                  <small> real · config {padrao} d</small>
                </span>
                <span className={`calib-tag ${aplicando ? 'on' : ''}`}>
                  {real.amostras === 0 ? 'sem dados' : aplicando ? `usando (${real.amostras})` : `${real.amostras}/${MIN_AMOSTRAS}`}
                </span>
              </div>
            )
          })}
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
    </>
  )
}
