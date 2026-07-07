import type { Ponto } from '../lib/indicadores'

function maxAgradavel(v: number): number {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const passo = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return passo * p
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })

export default function BarChart({ pontos, unidade = '', referencia }: { pontos: Ponto[]; unidade?: string; referencia?: { valor: number; label: string } }) {
  const W = 600, H = 240
  const padL = 40, padR = 8, padT = 12, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = pontos.length

  if (n === 0) return <div className="empty-note">Sem dados no período.</div>

  const maxDados = Math.max(...pontos.map((p) => p.valor), referencia ? referencia.valor : 0)
  const maxVal = maxAgradavel(maxDados)
  const slot = plotW / n
  const bw = Math.max(1, slot * 0.66)
  const y = (v: number) => padT + plotH * (1 - v / maxVal)
  const linhas = [0, maxVal / 2, maxVal]

  const strideRot = Math.ceil(n / 6)
  const mostrarValor = n <= 14

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: 'block' }}>
      {/* grade + rótulos do eixo Y */}
      {linhas.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize={11} fill="var(--text-muted)">{fmt(v)}</text>
        </g>
      ))}

      {/* barras */}
      {pontos.map((p, i) => {
        const x = padL + i * slot + (slot - bw) / 2
        const altura = plotH * (p.valor / maxVal)
        const yb = y(p.valor)
        return (
          <g key={i}>
            {p.valor > 0 && (
              <rect x={x} y={yb} width={bw} height={Math.max(0, altura)} rx={2} fill="var(--accent)" />
            )}
            {mostrarValor && p.valor > 0 && (
              <text x={x + bw / 2} y={yb - 4} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
                {fmt(p.valor)}
              </text>
            )}
            {(i % strideRot === 0 || i === n - 1) && (
              <text x={x + bw / 2} y={H - padB + 15} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
                {p.label}
              </text>
            )}
          </g>
        )
      })}

      {/* eixo base */}
      <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} />
      {unidade && <text x={padL - 6} y={padT - 2} textAnchor="end" fontSize={10} fill="var(--text-muted)">{unidade}</text>}

      {/* linha de referência (ex.: teto) */}
      {referencia && referencia.valor > 0 && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(referencia.valor)} y2={y(referencia.valor)}
            stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={W - padR} y={y(referencia.valor) - 4} textAnchor="end" fontSize={10} fill="var(--warning)">
            {referencia.label}
          </text>
        </g>
      )}
    </svg>
  )
}
