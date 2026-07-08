import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { useNav } from '../context/NavContext'
import type { Lote } from '../lib/lotes'

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

export default function ConteinerDetalhe() {
  const { config } = useConfig()
  const { lotes, ocupacaoConteinerKg } = useDados()
  const { irPara } = useNav()

  const capConteiner = config.numeroConteineres * config.capacidadeConteinerKg
  const pct = capConteiner > 0 ? (ocupacaoConteinerKg / capConteiner) * 100 : 0
  const noConteiner = lotes.filter((l) => !l.cancelado_em && l.tipo === 'producao' && l.etapa === 'frutificando')

  const numeros = Array.from({ length: Math.max(1, config.numeroConteineres) }, (_, i) => i + 1)

  return (
    <>
      <button className="btn btn-ghost voltar" onClick={() => irPara('painel')}>← Voltar ao painel</button>

      <div className="page-head">
        <h1 className="page-title">Contêiner</h1>
        <p className="page-desc">Tudo o que está frutificando agora, lote a lote.</p>
      </div>

      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Ocupação total</div>
          <div className="metric-value tnum">{fmt(ocupacaoConteinerKg)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">de {fmt(capConteiner)} kg</div>
        </div>
        <div className="metric">
          <div className="metric-label">Ocupação</div>
          <div className="metric-value tnum">{fmt(pct)}<span className="metric-unit">%</span></div>
          <div className="metric-foot">da capacidade</div>
        </div>
        <div className="metric">
          <div className="metric-label">Lotes ativos</div>
          <div className="metric-value tnum">{noConteiner.length}</div>
          <div className="metric-foot">frutificando</div>
        </div>
      </div>

      {noConteiner.length === 0 ? (
        <div className="empty-note">Nenhum lote frutificando no momento.</div>
      ) : config.numeroConteineres <= 1 ? (
        noConteiner.map((l) => <LoteContainerCard key={l.id} l={l} varios={false} />)
      ) : (
        numeros.map((num) => {
          const lista = noConteiner.filter((l) => (l.conteiner ?? 1) === num)
          if (lista.length === 0) return null
          const kg = lista.reduce((s, l) => s + Number(l.quantidade_kg), 0)
          return (
            <div key={num} style={{ marginBottom: 8 }}>
              <div className="group-label">Contêiner {num} · {fmt(kg)} kg</div>
              {lista.map((l) => <LoteContainerCard key={l.id} l={l} varios={true} />)}
            </div>
          )
        })
      )}
    </>
  )
}

function LoteContainerCard({ l, varios }: { l: Lote; varios: boolean }) {
  return (
    <div className="lote-item">
      <div className="lote-top">
        <span className="pill pill-producao">{l.codigo}</span>
        <span className="lote-qty">{fmt(l.quantidade_kg)}<small> kg</small>{l.bolsas ? <small> · {l.bolsas} bolsas</small> : null}</span>
        <span className="prazo ok">{textoPrazo(l.previsto_para)}</span>
      </div>
      <div className="kvs">
        <div className="kv"><span>Entrada no contêiner</span><b>{fmtData(l.etapa_desde)}</b></div>
        <div className="kv"><span>Saída prevista</span><b>{l.previsto_para ? fmtData(l.previsto_para) : '—'}</b></div>
        <div className="kv"><span>Contaminadas</span><b>{Number(l.bolsas_contaminadas ?? 0)} bolsas</b></div>
        {varios && <div className="kv"><span>Contêiner</span><b>{l.conteiner ?? '—'}</b></div>}
      </div>
    </div>
  )
}
