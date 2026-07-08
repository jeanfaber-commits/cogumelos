import { useRef, useState } from 'react'
import { useDados } from '../context/DadosContext'
import { useNav } from '../context/NavContext'
import LineChart from './LineChart'
import { baixarPng, baixarPdf } from '../lib/exportar'
import { capacidadeNecessaria } from '../lib/calculos'
import { diagnostico, planoInicio, serieProjecao, diasSustentandoTeto } from '../lib/assistente'
import { IconMushroom } from '../icons'

const fmt = (n: number, dec = 0) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const NOME_GARGALO: Record<string, string> = {
  incubacao: 'sala de incubação', pasteurizacao: 'pasteurização', conteiner: 'contêiner',
}

const MOTIVO: Record<string, string> = {
  teto: 'é o quanto o contêiner comporta na chegada — você está no ritmo do teto.',
  incubacao: 'é o limite da sala de incubação, que é o seu gargalo.',
  substrato: 'limitado pelo substrato em estoque.',
  spawn: 'limitado pelo spawn em estoque.',
}

export default function Assistente() {
  const { lotes, saldos, configEfetiva: config, teto } = useDados()
  const { irPara } = useNav()
  const [meta, setMeta] = useState(90)
  const projRef = useRef<HTMLDivElement>(null)

  const d = diagnostico(lotes, config)
  const plano = planoInicio(lotes, config, saldos)
  const proj = serieProjecao(lotes, config)
  const dias = diasSustentandoTeto(lotes, config)
  const metas = [75, 80, 90, 100].filter((m) => m > Math.ceil(teto.tetoPct))
  const metaSel = metas.includes(meta) ? meta : (metas[0] ?? 100)
  const conteinerLimitante = teto.gargalo === 'conteiner' || metas.length === 0
  const nec = capacidadeNecessaria(config, metaSel)

  const incubHoje = config.numeroIncubadoras * config.capacidadeIncubacaoKg
  const pastHoje = config.pasteurizacaoLoteKg * config.pasteurizacaoVezesSemana

  const dataFutura = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const preparar = plano.prepararCompostoKg > 0.5 || plano.prepararSpawnKg > 0.5
  const exportarProj = async (tipo: 'png' | 'pdf') => {
    const svg = projRef.current?.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    if (tipo === 'png') await baixarPng(svg, 'projecao-conteiner')
    else await baixarPdf(svg, 'projecao-conteiner', 'Projeção da ocupação do contêiner')
  }

  return (
    <>
      {/* Recomendação */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent-bg)', display: 'grid', placeItems: 'center', color: 'var(--accent)' }}>
            <IconMushroom size={18} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Assistente de produção</div>
        </div>

        <div className="assist-status">
          Contêiner a <b>{fmt(d.ocupacaoPct)}%</b> · teto <b>{fmt(d.tetoPct)}%</b> · gargalo <b>{NOME_GARGALO[d.gargalo]}</b>
        </div>

        <div className="assist-rec">
          {plano.producaoKg > 0.5 ? (
            <>
              <div className="assist-line">
                <span className="assist-emph">Iniciar hoje:</span> um lote de produção de <b>~{fmt(plano.producaoKg)} kg</b> de substrato
                {' '}({fmt(plano.producaoKg / config.pesoBolsaSubstratoKg)} bolsas) — {MOTIVO[plano.limitante] ?? ''}
              </div>
              <div className="assist-sub">
                Consome {fmt(plano.consumoSubstrato)} kg de substrato e {fmt(plano.consumoSpawn, 1)} kg de spawn do estoque.
              </div>
            </>
          ) : plano.limitante === 'nada' ? (
            <div className="assist-line">
              <span className="assist-emph">Nada a iniciar agora.</span> Com os lotes que já vão chegar, o contêiner fica no teto.
            </div>
          ) : plano.limitante === 'incubacao' ? (
            <div className="assist-line">
              <span className="assist-emph">Sala de incubação cheia.</span> Aguarde liberar espaço (um lote de spawn ou de colonização avançar) antes de iniciar mais.
            </div>
          ) : (
            <div className="assist-line">
              <span className="assist-emph">Sem estoque para iniciar.</span> Prepare composto e/ou spawn antes (veja abaixo).
            </div>
          )}

          {preparar && (
            <div className="assist-prep">
              Para aproveitar toda a capacidade, prepare agora (ficam prontos em ~14 dias):
              {plano.prepararCompostoKg > 0.5 && <> <b>{fmt(plano.prepararCompostoKg)} kg</b> de composto</>}
              {plano.prepararCompostoKg > 0.5 && plano.prepararSpawnKg > 0.5 && ' e'}
              {plano.prepararSpawnKg > 0.5 && <> <b>{fmt(plano.prepararSpawnKg, 1)} kg</b> de spawn</>}.
            </div>
          )}
        </div>
      </div>

      {/* Projeção */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Projeção do contêiner</div>
        <div className="section-sub">Ocupação prevista (kg) com o pipeline atual, sem novos lotes. A linha é o teto.</div>
        <button className="chart-open" onClick={() => irPara('projecaoDetalhe')} title="Abrir em tela cheia">
          <div ref={projRef}>
            <LineChart pontos={proj} unidade="kg" referencia={{ valor: d.tetoKg, label: `teto ${fmt(d.tetoKg)} kg` }} />
          </div>
          <span className="chart-open-hint">toque para ampliar e ver por lote</span>
        </button>
        <div className="export-bar">
          <span>Exportar:</span>
          <button className="btn btn-ghost" onClick={() => exportarProj('png')}>PNG</button>
          <button className="btn btn-ghost" onClick={() => exportarProj('pdf')}>PDF</button>
        </div>
        <div className="assist-proj-note">
          {dias === 0
            ? 'O contêiner já está abaixo do teto — iniciar produção o recupera.'
            : dias != null && dias >= 120
              ? 'O pipeline mantém o teto por todo o horizonte projetado.'
              : `O pipeline mantém o teto até cerca de ${dataFutura(dias ?? 0)}. Depois começa a esvaziar — inicie lotes para cobrir a queda.`}
        </div>
      </div>

      {/* Expansão */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 2 }}>Planejar expansão</div>
        {conteinerLimitante ? (
          <>
            <div className="section-sub">O contêiner é o recurso limitante e já opera no teto de {fmt(teto.tetoPct)}%.</div>
            <div className="assist-prep" style={{ marginTop: 4 }}>
              Para produzir mais, adicione capacidade de <b>contêiner</b> de frutificação. A incubação comporta até
              {' '}<b>{fmt(teto.limites.incubacaoPct)}%</b> e a pasteurização até <b>{fmt(teto.limites.pasteurizacaoPct)}%</b> de
              um contêiner — ambas têm folga para um segundo. Ajuste o número de contêineres em Configurações.
            </div>
          </>
        ) : (
          <>
            <div className="section-sub">Quanto expandir para elevar o teto acima dos {fmt(teto.tetoPct)}% de hoje.</div>
            <div className="seg" style={{ marginBottom: 14 }}>
              {metas.map((m) => (
                <button key={m} className={metaSel === m ? 'on' : ''} onClick={() => setMeta(m)}>{m}%</button>
              ))}
            </div>
            <div className="assist-exp">
              <div className="exp-row">
                <span>Incubação</span>
                <span className="tnum">≥ {fmt(nec.incubacaoNecessariaKg)} kg <small>(hoje {fmt(incubHoje)})</small></span>
              </div>
              <div className="exp-row">
                <span>Pasteurização</span>
                <span className="tnum">≥ {fmt(nec.pasteurizacaoNecessariaSemana)} kg/sem <small>(hoje {fmt(pastHoje)})</small></span>
              </div>
              <div className="exp-row">
                <span>Substrato inoculado</span>
                <span className="tnum">{fmt(nec.substratoInoculadoDia)} kg/dia</span>
              </div>
            </div>
            <div className="help">
              Para o contêiner sustentar {metaSel}%, a incubação e a pasteurização precisam acompanhar esse ritmo de inoculação.
              Ajuste as capacidades em Configurações quando expandir.
            </div>
          </>
        )}
      </div>
    </>
  )
}
