import Gauge from '../components/Gauge'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { producaoNoPeriodo } from '../lib/colheita'
import Assistente from '../components/Assistente'
import { useNav } from '../context/NavContext'

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

function Metric({ label, value, unit, foot }: { label: string; value?: string; unit?: string; foot: string }) {
  const vazio = value == null
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value tnum ${vazio ? 'empty' : ''}`}>
        {vazio ? '—' : value}{unit && <span className="metric-unit">{unit}</span>}
      </div>
      <div className="metric-foot">{foot}</div>
    </div>
  )
}

export default function Painel() {
  const { config } = useConfig()
  const { irPara } = useNav()
  const { ocupacaoConteinerKg, ocupacaoIncubacaoKg, bolsasFrutificando, colheitas, eficienciaBiologica, sanidade, teto } = useDados()
  const producao30 = producaoNoPeriodo(colheitas, new Date(Date.now() - 30 * 86400000))

  const capConteiner = config.numeroConteineres * config.capacidadeConteinerKg
  const capIncubacao = config.numeroIncubadoras * config.capacidadeIncubacaoKg
  const pctConteiner = capConteiner > 0 ? (ocupacaoConteinerKg / capConteiner) * 100 : 0
  const pctIncubacao = capIncubacao > 0 ? (ocupacaoIncubacaoKg / capIncubacao) * 100 : 0

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Painel</h1>
        <p className="page-desc">Estado atual da produção e indicadores.</p>
      </div>

      {/* Ocupação do contêiner vs. teto — clicável */}
      <div className="card gauge-card clicavel" style={{ marginBottom: 14 }} role="button" tabIndex={0}
        onClick={() => irPara('conteinerDetalhe')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') irPara('conteinerDetalhe') }}>
        <Gauge value={pctConteiner} ceiling={Math.round(teto.tetoPct)} />
        <div className="gauge-legend">
          <div className="gauge-titulo">CONTÊINER</div>
          <div className="legend-row">
            <span className="legend-key">Ocupação</span>
            <span className="legend-val tnum">{fmt(ocupacaoConteinerKg)} kg</span>
          </div>
          <div className="legend-row">
            <span className="legend-key">Teto sustentável</span>
            <span className="legend-val tnum">{fmt(teto.tetoPct)}%</span>
          </div>
          <div className="ver-detalhes">Toque para ver os lotes ›</div>
        </div>
      </div>

      {/* Ocupação da incubação — clicável */}
      <div className="card gauge-card clicavel" style={{ marginBottom: 14 }} role="button" tabIndex={0}
        onClick={() => irPara('incubacaoDetalhe')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') irPara('incubacaoDetalhe') }}>
        <Gauge value={pctIncubacao} ceiling={100} />
        <div className="gauge-legend">
          <div className="gauge-titulo">SALA DE INCUBAÇÃO</div>
          <div className="legend-row">
            <span className="legend-key">Ocupação</span>
            <span className="legend-val tnum">{fmt(ocupacaoIncubacaoKg)} kg</span>
          </div>
          <div className="legend-row">
            <span className="legend-key">Capacidade</span>
            <span className="legend-val tnum">{fmt(capIncubacao)} kg</span>
          </div>
          <div className="ver-detalhes">Toque para ver os lotes ›</div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        <Metric label="Eficiência biológica"
          value={eficienciaBiologica == null ? undefined : fmt(eficienciaBiologica)} unit="%" foot={`agregada · meta ${fmt(config.beAlvoPct)}%`} />
        <Metric label="Sanidade"
          value={sanidade == null ? undefined : fmt(sanidade)} unit="%" foot="bolsas sem contaminação" />
        <Metric label="Bolsas em produção" value={fmt(bolsasFrutificando)} foot="frutificando no contêiner" />
        <Metric label="Produção prevista" unit="kg" foot="próximos dias" />
        <Metric label="Produção realizada" value={fmt(producao30)} unit="kg" foot="últimos 30 dias" />
      </div>

      <Assistente />
    </>
  )
}
