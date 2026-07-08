import type { Ponto } from '../lib/indicadores'

function maxAgradavel(v: number): number {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return passo * p
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })

export default function LineChart({ pontos, unidade = '', referencia }: { pontos: Ponto[]; unidade?: string; referencia?: { valor: number; label: string } }) {
  const W = 600, H = 240
  const padL = 40, padR = 10, padT = 12, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = pontos.length

  if (n === 0) return <div className="empty-note">Sem dados no período.</div>

  const maxVal = maxAgradavel(Math.max(...pontos.map((p) => p.valor), referencia ? referencia.valor : 0))
  const x = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW)
  const y = (v: number) => padT + plotH * (1 - v / maxVal)
  const linhas = [0, maxVal / 2, maxVal]

  const pts = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')
  const area = `M ${x(0).toFixed(1)},${y(0).toFixed(1)} L ${pts.replace(/ /g, ' L ')} L ${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`
  const strideRot = Math.ceil(n / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block' }}>
      {linhas.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize={11} fill="var(--text-muted)">{fmt(v)}</text>
        </g>
      ))}

      {/* área + linha */}
      <path d={area} fill="var(--accent)" opacity={0.12} />
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* pontos */}
      {pontos.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.valor)} r={2.6} fill="var(--accent)" />
          {(i % strideRot === 0 || i === n - 1) && (
            <text x={x(i)} y={H - padB + 15} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{p.label}</text>
          )}
        </g>
      ))}

      {/* valores nas pontas */}
      <text x={x(0)} y={y(pontos[0].valor) - 7} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">{fmt(pontos[0].valor)}</text>
      {n > 1 && (
        <text x={x(n - 1)} y={y(pontos[n - 1].valor) - 7} textAnchor="end" fontSize={10} fill="var(--text-secondary)">{fmt(pontos[n - 1].valor)}</text>
      )}

      <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
      {unidade && <text x={padL - 6} y={padT - 2} textAnchor="end" fontSize={10} fill="var(--text-muted)">{unidade}</text>}

      {referencia && referencia.valor > 0 && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(referencia.valor)} y2={y(referencia.valor)}
            stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - padR} y={y(referencia.valor) - 4} textAnchor="end" fontSize={10} fill="var(--warning)">{referencia.label}</text>
        </g>
      )}
    </svg>
  )
}
