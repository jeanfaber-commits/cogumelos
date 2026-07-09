import { useState } from 'react'
import { useDados } from '../context/DadosContext'
import { useNav } from '../context/NavContext'
import LineChart from '../components/LineChart'
import ChartFrame from '../components/ChartFrame'
import { serieProjecao, serieProjecaoPorLote, diasSustentandoTeto } from '../lib/assistente'

const fmt = (n: number, dec = 0) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

export default function ProjecaoDetalhe() {
  const { lotes, configEfetiva: config, teto } = useDados()
  const { irPara } = useNav()
  const [modo, setModo] = useState<'total' | 'lote'>('total')

  const capC = config.numeroConteineres * config.capacidadeConteinerKg
  const tetoKg = (capC * teto.tetoPct) / 100
  const proj = serieProjecao(lotes, config)
  const porLote = serieProjecaoPorLote(lotes, config)
  const dias = diasSustentandoTeto(lotes, config)
  const dataFutura = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <>
      <button className="btn btn-ghost voltar" onClick={() => irPara('painel')}>← Voltar ao painel</button>

      <div className="page-head">
        <h1 className="page-title">Projeção do contêiner</h1>
        <p className="page-desc">Ocupação prevista (kg) com o pipeline atual. A linha tracejada é o teto.</p>
      </div>

      <div className="seg" style={{ marginBottom: 12, maxWidth: 320 }}>
        <button className={modo === 'total' ? 'on' : ''} onClick={() => setModo('total')}>Total</button>
        <button className={modo === 'lote' ? 'on' : ''} onClick={() => setModo('lote')}>Por lote</button>
      </div>

      <div className="rotate-hint">Vire o aparelho na horizontal para ver o gráfico maior.</div>

      <div className="card projecao-full">
        <ChartFrame titulo="Projeção do contêiner">
          {modo === 'total' ? (
            <LineChart pontos={proj} unidade="kg" altura={360}
              referencia={{ valor: tetoKg, label: `teto ${fmt(tetoKg)} kg` }} />
          ) : porLote.series.length === 0 ? (
            <div className="empty-note">Nenhum lote em produção ou colonização para projetar.</div>
          ) : (
            <LineChart series={porLote.series} unidade="kg" altura={360}
              referencia={{ valor: tetoKg, label: `teto ${fmt(tetoKg)} kg` }} />
          )}
        </ChartFrame>
      </div>

      <div className="assist-proj-note" style={{ marginTop: 10 }}>
        {modo === 'lote'
          ? 'Linhas acumulativas: cada faixa entre duas linhas é um lote, e a linha mais alta é a lotação total prevista.'
          : dias === 0
            ? 'O contêiner já está abaixo do teto — iniciar produção o recupera.'
            : dias != null && dias >= 120
              ? 'O pipeline mantém o teto por todo o horizonte projetado.'
              : `O pipeline mantém o teto até cerca de ${dataFutura(dias ?? 0)}. Depois começa a esvaziar.`}
      </div>
    </>
  )
}
