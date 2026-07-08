import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { calcularComposto, calcularSpawn } from '../lib/calculos'

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// -------- Calculadora do composto --------
function Composto() {
  const { config } = useConfig()
  const [modo, setModo] = useState<'kg' | 'bolsas'>('kg')
  const [valor, setValor] = useState('1000')
  // Umidade de cada ingrediente é editável aqui (começa com o padrão).
  const [umidades, setUmidades] = useState<number[]>(() => config.ingredientesComposto.map((i) => i.umidadePct))

  const setUmidade = (i: number, v: number) => setUmidades((prev) => prev.map((u, j) => (j === i ? v : u)))

  const ingredientes = config.ingredientesComposto.map((ing, i) => ({ ...ing, umidadePct: umidades[i] ?? ing.umidadePct }))
  const n = Number(valor) || 0
  const alvoKg = modo === 'kg' ? n : n * config.pesoBolsaSubstratoKg
  const r = calcularComposto({ ...config, ingredientesComposto: ingredientes }, alvoKg)

  return (
    <div className="card">
      <div className="section-title">Composto → substrato</div>
      <div className="section-sub">Digite a umidade de cada ingrediente e veja o peso úmido na hora. Alvo a {config.umidadeAlvoSubstratoPct}% de umidade.</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="num-field" style={{ flex: 1, minWidth: 160 }}>
          <label>Quero produzir</label>
          <div className="num-wrap">
            <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            <span className="unit">{modo === 'kg' ? 'kg' : 'bolsas'}</span>
          </div>
        </div>
        <div className="seg">
          <button className={modo === 'kg' ? 'on' : ''} onClick={() => setModo('kg')}>kg</button>
          <button className={modo === 'bolsas' ? 'on' : ''} onClick={() => setModo('bolsas')}>bolsas</button>
        </div>
      </div>

      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Ingrediente</th><th className="r">Mat. seca</th><th className="r">Umidade %</th><th className="r">Peso úmido</th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.map((l, i) => (
              <tr key={l.nome}>
                <td>{l.nome}</td>
                <td className="r">{fmt(l.secoKg)} kg</td>
                <td className="r">
                  <input className="in-cell" type="number" step={1} value={umidades[i] ?? 0}
                    onChange={(e) => setUmidade(i, Number(e.target.value))} />
                </td>
                <td className="r">{fmt(l.umidoKg)} kg</td>
              </tr>
            ))}
            <tr>
              <td>Água a adicionar</td><td className="r">—</td><td className="r">—</td><td className="r">{fmt(r.aguaAdicionarKg)} kg</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td>Total (substrato pronto)</td><td className="r">{fmt(r.massaSecaKg)} kg</td><td className="r">—</td><td className="r">{fmt(r.totalKg)} kg</td></tr>
          </tfoot>
        </table>
      </div>

      {modo === 'bolsas' && (
        <div className="help">Equivale a {fmt(alvoKg, 0)} kg de substrato ({fmt(n, 0)} bolsas de {config.pesoBolsaSubstratoKg} kg).</div>
      )}
      {r.aviso && <div className="aviso">{r.aviso}</div>}
    </div>
  )
}

// -------- Calculadora do spawn --------
function Spawn() {
  const { config } = useConfig()
  const [modo, setModo] = useState<'kg' | 'bolsas'>('kg')
  const [valor, setValor] = useState('50')

  const n = Number(valor) || 0
  const alvoKg = modo === 'kg' ? n : n * config.pesoBolsaSpawnKg
  const r = calcularSpawn(config, alvoKg)

  return (
    <div className="card">
      <div className="section-title">Spawn de sorgo</div>
      <div className="section-sub">Sorgo seco e CL F2 para a quantidade de spawn desejada.</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="num-field" style={{ flex: 1, minWidth: 160 }}>
          <label>Quero produzir</label>
          <div className="num-wrap">
            <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
            <span className="unit">{modo === 'kg' ? 'kg' : 'bolsas'}</span>
          </div>
        </div>
        <div className="seg">
          <button className={modo === 'kg' ? 'on' : ''} onClick={() => setModo('kg')}>kg</button>
          <button className={modo === 'bolsas' ? 'on' : ''} onClick={() => setModo('bolsas')}>bolsas</button>
        </div>
      </div>

      <div className="result-highlight">
        <span className="rh-label">Sorgo seco a pesar</span>
        <span className="rh-val tnum">{fmt(r.sorgoSecoKg)} kg</span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        <div className="metric" style={{ flex: 1, minWidth: 150 }}>
          <div className="metric-label">CL F2</div>
          <div className="metric-value tnum" style={{ fontSize: 24 }}>{fmt(r.clF2ml, 0)}<span className="metric-unit">mL</span></div>
          <div className="metric-foot">para dar baixa no estoque</div>
        </div>
        <div className="metric" style={{ flex: 1, minWidth: 150 }}>
          <div className="metric-label">Rende</div>
          <div className="metric-value tnum" style={{ fontSize: 24 }}>{fmt(r.bolsas, 0)}<span className="metric-unit">bolsas</span></div>
          <div className="metric-foot">de {config.pesoBolsaSpawnKg} kg cada</div>
        </div>
      </div>
      {modo === 'bolsas' && (
        <div className="help">Equivale a {fmt(alvoKg, 1)} kg de spawn.</div>
      )}
    </div>
  )
}

export default function Formulacao() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Formulação</h1>
        <p className="page-desc">Cálculo de ingredientes para composto e para spawn.</p>
      </div>
      <Composto />
      <Spawn />
    </>
  )
}
