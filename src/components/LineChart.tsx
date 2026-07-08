import type { Ponto } from '../lib/indicadores'

export type SerieLinha = { nome: string; cor?: string; pontos: Ponto[]; tracejado?: boolean }

const PALETA = ['var(--accent)', '#e0803a', '#3a9ad9', '#c0553a', '#7a9a3a', '#9a3a7a', '#3ac0a0', '#c0a03a', '#d94f7a', '#5a7ad9']

function maxAgradavel(v: number): number {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return passo * p
}
const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })

export default function LineChart({
  pontos, series, unidade = '', referencia, rotulosValores, altura,
}: {
  pontos?: Ponto[]
  series?: SerieLinha[]
  unidade?: string
  referencia?: { valor: number; label: string }
  rotulosValores?: boolean
  altura?: number
}) {
  const listas: SerieLinha[] = series && series.length ? series : pontos ? [{ nome: '', pontos, cor: 'var(--accent)' }] : []
  const multi = listas.length > 1
  const mostrarValores = rotulosValores ?? !multi
  const base = listas[0]?.pontos ?? []
  const n = base.length
  if (n === 0) return <div className="empty-note">Sem dados no período.</div>

  const W = 600, H = altura ?? 240
  const padL = 40, padR = 12, padT = 14, padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const maxTodos = Math.max(...listas.flatMap((s) => s.pontos.map((p) => p.valor)), referencia ? referencia.valor : 0)
  const maxVal = maxAgradavel(maxTodos)
  const x = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW)
  const y = (v: number) => padT + plotH * (1 - v / maxVal)
  const linhas = [0, maxVal / 2, maxVal]
  const strideRot = Math.ceil(n / (W > 500 ? 8 : 6))
  const cor = (s: SerieLinha, i: number) => s.cor ?? PALETA[i % PALETA.length]

  return (
    <div className="linechart">
      {multi && (
        <div className="chart-legend">
          {listas.map((s, i) => (
            <span key={s.nome + i}><i style={{ background: cor(s, i) }} /> {s.nome}</span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block' }}>
        {linhas.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize={11} fill="var(--text-muted)">{fmt(v)}</text>
          </g>
        ))}

        {/* área só quando é uma série única */}
        {!multi && (
          <path
            d={`M ${x(0).toFixed(1)},${y(0).toFixed(1)} L ${base.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' L ')} L ${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`}
            fill="var(--accent)" opacity={0.12}
          />
        )}

        {/* linhas */}
        {listas.map((s, si) => (
          <polyline key={si} points={s.pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}
            fill="none" stroke={cor(s, si)} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.tracejado ? '5 4' : undefined} />
        ))}

        {/* pontos + rótulos de valor */}
        {listas.map((s, si) => (
          <g key={'p' + si}>
            {s.pontos.map((p, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(p.valor)} r={2.6} fill={cor(s, si)} />
                {mostrarValores && (
                  <text x={x(i)} y={y(p.valor) - 7} textAnchor="middle" fontSize={9.5} fill="var(--text-secondary)">{fmt(p.valor)}</text>
                )}
              </g>
            ))}
          </g>
        ))}

        {/* rótulos do eixo x */}
        {base.map((p, i) => (
          (i % strideRot === 0 || i === n - 1) && (
            <text key={'x' + i} x={x(i)} y={H - padB + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{p.label}</text>
          )
        ))}

        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
        {unidade && <text x={padL - 6} y={padT - 3} textAnchor="end" fontSize={10} fill="var(--text-muted)">{unidade}</text>}

        {referencia && referencia.valor > 0 && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(referencia.valor)} y2={y(referencia.valor)}
              stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={W - padR} y={y(referencia.valor) - 4} textAnchor="end" fontSize={10} fill="var(--warning)">{referencia.label}</text>
          </g>
        )}
      </svg>
    </div>
  )
}
