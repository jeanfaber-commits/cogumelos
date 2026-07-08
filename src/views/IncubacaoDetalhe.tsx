import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { useNav } from '../context/NavContext'
import { rotuloEtapa, type Lote } from '../lib/lotes'

const fmt = (n: number, dec = 0) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const diasRestantes = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null)

function textoPrazo(iso: string | null): string {
  const d = diasRestantes(iso)
  if (d == null) return '—'
  if (d <= 0) return 'no ponto'
  return d === 1 ? 'falta 1 dia' : `faltam ${d} dias`
}

export default function IncubacaoDetalhe() {
  const { config } = useConfig()
  const { lotes, ocupacaoIncubacaoKg } = useDados()
  const { irPara } = useNav()

  const cap = config.numeroIncubadoras * config.capacidadeIncubacaoKg
  const pct = cap > 0 ? (ocupacaoIncubacaoKg / cap) * 100 : 0

  const naSala = lotes.filter(
    (l) => !l.cancelado_em && ((l.tipo === 'spawn' && l.etapa === 'incubando') || (l.tipo === 'producao' && l.etapa === 'colonizando')),
  )
  // spawn primeiro, depois por data de entrada
  naSala.sort((a, b) => new Date(a.previsto_para ?? a.etapa_desde).getTime() - new Date(b.previsto_para ?? b.etapa_desde).getTime())

  const ocupaKg = (l: Lote) =>
    l.tipo === 'spawn' ? Number(l.quantidade_kg) * config.fatorOcupacaoSpawn : Number(l.quantidade_kg) * config.fatorOcupacaoSubstrato

  return (
    <>
      <button className="btn btn-ghost voltar" onClick={() => irPara('painel')}>← Voltar ao painel</button>

      <div className="page-head">
        <h1 className="page-title">Sala de incubação</h1>
        <p className="page-desc">Spawn incubando e substrato colonizando, lote a lote.</p>
      </div>

      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Ocupação total</div>
          <div className="metric-value tnum">{fmt(ocupacaoIncubacaoKg)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">de {fmt(cap)} kg-equiv.</div>
        </div>
        <div className="metric">
          <div className="metric-label">Ocupação</div>
          <div className="metric-value tnum">{fmt(pct)}<span className="metric-unit">%</span></div>
          <div className="metric-foot">da capacidade</div>
        </div>
        <div className="metric">
          <div className="metric-label">Lotes ativos</div>
          <div className="metric-value tnum">{naSala.length}</div>
          <div className="metric-foot">na incubação</div>
        </div>
      </div>

      {naSala.length === 0 ? (
        <div className="empty-note">Nenhum lote na incubação no momento.</div>
      ) : (
        naSala.map((l) => (
          <div className="lote-item" key={l.id}>
            <div className="lote-top">
              <span className={`pill pill-${l.tipo}`}>{l.codigo}</span>
              <span className="lote-qty">{fmt(l.quantidade_kg)}<small> kg</small>{l.bolsas ? <small> · {l.bolsas} bolsas</small> : null}</span>
              <span className="prazo ok">{textoPrazo(l.previsto_para)}</span>
            </div>
            <div className="kvs">
              <div className="kv"><span>Etapa</span><b>{rotuloEtapa(l.etapa)}</b></div>
              <div className="kv"><span>Ocupa</span><b>{fmt(ocupaKg(l))} kg-equiv.</b></div>
              <div className="kv"><span>Entrada</span><b>{fmtData(l.etapa_desde)}</b></div>
              <div className="kv"><span>{l.tipo === 'spawn' ? 'Pronto previsto' : 'Fim da colonização'}</span><b>{l.previsto_para ? fmtData(l.previsto_para) : '—'}</b></div>
              {l.tipo === 'producao' && <div className="kv"><span>Contaminadas</span><b>{Number(l.bolsas_contaminadas ?? 0)} bolsas</b></div>}
            </div>
          </div>
        ))
      )}
    </>
  )
}
