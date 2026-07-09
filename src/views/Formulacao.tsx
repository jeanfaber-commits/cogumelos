import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { calcularComposto, calcularSpawn, type Ingrediente } from '../lib/calculos'
import { IconPlus, IconTrash } from '../icons'

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// -------- Calculadora do composto --------
function Composto() {
  const { config } = useConfig()
  const { novoLote } = useDados()
  const [modo, setModo] = useState<'kg' | 'bolsas'>('kg')
  const [valor, setValor] = useState('1000')
  // A receita é editável aqui (começa com a configurada). Matéria seca, umidade,
  // nome, e dá para incluir ou remover ingredientes.
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>(() => config.ingredientesComposto.map((i) => ({ ...i })))
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const editar = (i: number, patch: Partial<Ingrediente>) =>
    setIngredientes((prev) => prev.map((ing, j) => (j === i ? { ...ing, ...patch } : ing)))
  const remover = (i: number) => setIngredientes((prev) => prev.filter((_, j) => j !== i))
  const adicionar = () => setIngredientes((prev) => [...prev, { nome: 'Novo ingrediente', materiaSecaPct: 0, umidadePct: 0 }])

  const n = Number(valor) || 0
  const alvoKg = modo === 'kg' ? n : n * config.pesoBolsaSubstratoKg
  const r = calcularComposto({ ...config, ingredientesComposto: ingredientes }, alvoKg)

  const somaMS = r.somaMateriaSecaPct
  const excedeu = somaMS > 100.001
  const incompleta = somaMS < 99.999
  const podeRegistrar = !excedeu && alvoKg > 0 && ingredientes.length > 0 && !salvando

  const registrar = async () => {
    if (excedeu) return
    if (!confirm(`Registrar o início da compostagem de ${fmt(alvoKg, 0)} kg com esta receita?`)) return
    setSalvando(true); setMsg('')
    const erro = await novoLote('composto', alvoKg, null, undefined, ingredientes)
    setSalvando(false)
    setMsg(erro ?? `Lote de composto registrado com a receita atual.`)
  }

  return (
    <div className="card">
      <div className="section-title">Composto → substrato</div>
      <div className="section-sub">Ajuste a matéria seca e a umidade de cada ingrediente. Alvo a {config.umidadeAlvoSubstratoPct}% de umidade.</div>

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
              <th>Ingrediente</th><th className="r">MS %</th><th className="r">Umidade %</th>
              <th className="r">Mat. seca</th><th className="r">Peso úmido</th><th></th>
            </tr>
          </thead>
          <tbody>
            {r.linhas.map((l, i) => (
              <tr key={i}>
                <td>
                  <input className="in-cell nome" type="text" value={ingredientes[i].nome}
                    onChange={(e) => editar(i, { nome: e.target.value })} />
                </td>
                <td className="r">
                  <input className="in-cell" type="number" step={0.5} min={0} value={ingredientes[i].materiaSecaPct}
                    onChange={(e) => editar(i, { materiaSecaPct: Number(e.target.value) })} />
                </td>
                <td className="r">
                  <input className="in-cell" type="number" step={1} min={0} max={99} value={ingredientes[i].umidadePct}
                    onChange={(e) => editar(i, { umidadePct: Number(e.target.value) })} />
                </td>
                <td className="r">{fmt(l.secoKg)} kg</td>
                <td className="r">{fmt(l.umidoKg)} kg</td>
                <td className="r">
                  <button className="btn btn-ghost icon-btn" onClick={() => remover(i)} aria-label={`Remover ${l.nome}`}>
                    <IconTrash size={16} />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>Água a adicionar</td><td className="r">—</td><td className="r">—</td>
              <td className="r">—</td><td className="r">{fmt(r.aguaAdicionarKg)} kg</td><td></td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>Total (substrato pronto)</td>
              <td className={`r ${excedeu ? 'ms-erro' : incompleta ? 'ms-aviso' : 'ms-ok'}`}>{fmt(somaMS)}%</td>
              <td className="r">—</td>
              <td className="r">{fmt(r.massaSecaKg)} kg</td>
              <td className="r">{fmt(r.totalKg)} kg</td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button className="btn btn-ghost add-ing" onClick={adicionar}>
        <IconPlus size={16} /> Adicionar ingrediente
      </button>

      {excedeu && (
        <div className="aviso erro">
          A soma da matéria seca é {fmt(somaMS)}% — não pode passar de 100%. Reduza algum ingrediente para registrar.
        </div>
      )}
      {!excedeu && incompleta && (
        <div className="aviso">
          A soma da matéria seca é {fmt(somaMS)}% — falta {fmt(100 - somaMS)}% para fechar a receita.
        </div>
      )}
      {!excedeu && r.aviso && !incompleta && <div className="aviso">{r.aviso}</div>}
      {modo === 'bolsas' && (
        <div className="help">Equivale a {fmt(alvoKg, 0)} kg de substrato ({fmt(n, 0)} bolsas de {config.pesoBolsaSubstratoKg} kg).</div>
      )}

      <div className="registrar-bar">
        <button className="btn btn-primary" disabled={!podeRegistrar} onClick={registrar}>
          {salvando ? 'Registrando…' : 'Registrar início da compostagem'}
        </button>
        <span className="help" style={{ margin: 0 }}>
          Cria um lote de composto e guarda esta receita junto com ele.
        </span>
      </div>
      {msg && <div className="aviso ok">{msg}</div>}
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
