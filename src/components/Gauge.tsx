// Indicador de ocupação — o elemento central do painel.
// Mostra a ocupação atual como um anel, com um marcador do "teto sustentável"
// (o limite que o gargalo permite; hoje ~67% num contêiner). Sem dados ainda,
// o anel aparece vazio mas o marcador do teto continua visível.

type Props = {
  value: number | null   // ocupação atual em %
  ceiling: number        // teto sustentável em %
  size?: number
}

export default function Gauge({ value, ceiling, size = 150 }: Props) {
  const r = 64
  const c = 2 * Math.PI * r
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value))
  const filled = (pct / 100) * c

  // Cor da ocupação em relação ao teto: perto do teto = saudável (verde),
  // acima = alerta, bem abaixo = ainda subindo.
  let stroke = 'var(--accent)'
  if (value != null) {
    if (value > ceiling + 2) stroke = 'var(--danger)'
    else if (value < ceiling - 15) stroke = 'var(--warning)'
  }

  // Posição do marcador do teto no anel.
  const a = (ceiling / 100) * 2 * Math.PI
  const inner = r - 9, outer = r + 9
  const cx = size / 2, cy = size / 2
  const x1 = cx + inner * Math.cos(a), y1 = cy + inner * Math.sin(a)
  const x2 = cx + outer * Math.cos(a), y2 = cy + outer * Math.sin(a)

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--border-strong)" strokeWidth={12} />
        {value != null && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={stroke} strokeWidth={12} strokeLinecap="round"
            strokeDasharray={`${filled} ${c - filled}`} />
        )}
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="var(--text)" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <div className="gauge-center">
        <div className={`gauge-pct tnum ${value == null ? 'empty' : ''}`}>
          {value == null ? '—' : `${Math.round(value)}%`}
        </div>
        <div className="gauge-caption">teto {ceiling}%</div>
      </div>
    </div>
  )
}
