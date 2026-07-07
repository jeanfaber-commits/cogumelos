import Gauge from '../components/Gauge'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { producaoNoPeriodo } from '../lib/colheita'
import Assistente from '../components/Assistente'
import type { ResultadoTeto } from '../lib/calculos'

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const NOME_GARGALO: Record<string, string> = {
  incubacao: 'sala de incubação', pasteurizacao: 'pasteurização', conteiner: 'contêiner',
}

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
  const ctx = useConfig() as ReturnType<typeof useConfig> & { teto: ResultadoTeto }
  const { config, teto } = ctx
  const { ocupacaoConteinerKg, ocupacaoIncubacaoKg, bolsasFrutificando, colheitas, eficienciaBiologica, sanidade } = useDados()
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

      {/* Ocupação do contêiner vs. teto */}
      <div className="card gauge-card" style={{ marginBottom: 14 }}>
        <Gauge value={pctConteiner} ceiling={Math.round(teto.tetoPct)} />
        <div className="gauge-legend">
          <div className="legend-row">
            <span className="legend-key">Ocupação do contêiner</span>
            <span className="legend-val tnum">{fmt(ocupacaoConteinerKg)} kg</span>
          </div>
          <div className="legend-row">
            <span className="legend-key">Teto sustentável</span>
            <span className="legend-val tnum">{fmt(teto.tetoPct)}%</span>
          </div>
          <div className="empty-note" style={{ marginTop: 4 }}>
            Teto limitado hoje pela <b>{NOME_GARGALO[teto.gargalo]}</b>. Capacidade total: {fmt(capConteiner)} kg.
          </div>
        </div>
      </div>

      {/* Ocupação da incubação */}
      <div className="card gauge-card" style={{ marginBottom: 14 }}>
        <Gauge value={pctIncubacao} ceiling={100} />
        <div className="gauge-legend">
          <div className="legend-row">
            <span className="legend-key">Ocupação da incubação</span>
            <span className="legend-val tnum">{fmt(ocupacaoIncubacaoKg)} kg</span>
          </div>
          <div className="legend-row">
            <span className="legend-key">Capacidade</span>
            <span className="legend-val tnum">{fmt(capIncubacao)} kg</span>
          </div>
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
