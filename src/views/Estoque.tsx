import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { supabaseConfigured } from '../lib/supabase'
import { ITENS_ESTOQUE, ROTULO_TIPO, nomeItem, type ItemEstoque } from '../lib/estoque'
import { emAndamento, rotuloTipoLote, rotuloEtapa, gerarCodigoLote, type Lote, type TipoLote } from '../lib/lotes'
import { CAUSAS, rotuloCausa, type CausaContaminacao } from '../lib/contaminacao'

const unidadeItem = (it: ItemEstoque) => ITENS_ESTOQUE.find((i) => i.id === it)?.unidade ?? 'kg'
const hojeISO = () => { const d = new Date(); const p = (x: number) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

function prazo(l: Lote): { texto: string; tom: 'ok' | 'pronto' } | null {
  if (!l.previsto_para || !emAndamento(l)) return null
  const dias = Math.ceil((new Date(l.previsto_para).getTime() - Date.now()) / 86400000)
  if (dias <= 0) return { texto: 'no ponto', tom: 'pronto' }
  return { texto: dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`, tom: 'ok' }
}

// item de lote
function LoteItem({ l }: { l: Lote }) {
  const { config } = useConfig()
  const { loteMarcarPronto, loteMoverConteiner, loteEncerrar, loteCancelar, loteContaminacao } = useDados()
  const [movendo, setMovendo] = useState(false)
  const [bolsasMover, setBolsasMover] = useState('')
  const [contaminando, setContaminando] = useState(false)
  const [qtdCont, setQtdCont] = useState('')
  const [causaCont, setCausaCont] = useState<CausaContaminacao>('desconhecida')
  const [ocupado, setOcupado] = useState(false)
  const p = prazo(l)

  const agir = async (fn: () => Promise<string | null>) => {
    setOcupado(true); const erro = await fn(); setOcupado(false)
    if (erro) alert(erro)
  }
  const abrirMover = () => { setBolsasMover(String(l.bolsas ?? '')); setMovendo(true) }
  const mover = async (conteiner: number) => {
    const raw = Math.round(Number(bolsasMover) || 0)
    const nb = l.bolsas && raw > 0 && raw < l.bolsas ? raw : null // null = mover tudo
    setMovendo(false)
    await agir(() => loteMoverConteiner(l, conteiner, nb))
  }
  const confirmarCont = async () => {
    const nb = Math.round(Number(qtdCont) || 0)
    setContaminando(false); setQtdCont('')
    if (nb > 0) await agir(() => loteContaminacao(l, nb, causaCont))
  }

  const contaminadas = Number(l.bolsas_contaminadas ?? 0)

  return (
    <div className="lote-item">
      <div className="lote-top">
        <span className={`pill pill-${l.tipo}`}>{rotuloTipoLote(l.tipo)}</span>
        <span className="lote-qty">
          {fmt(l.quantidade_kg, 0)}<small> kg</small>
          {l.bolsas ? <small> · {l.bolsas} bolsas</small> : null}
        </span>
        {p && <span className={`prazo ${p.tom}`}>{p.texto}</span>}
      </div>
      <div className="lote-code">
        {l.codigo} · {rotuloEtapa(l.etapa)}
        {l.conteiner ? ` · contêiner ${l.conteiner}` : ''} · início {fmtData(l.iniciado_em)}
        {contaminadas > 0 ? ` · ${contaminadas} contaminadas` : ''}
      </div>

      {movendo ? (
        <div className="picker">
          <span>Mover p/ contêiner</span>
          {l.bolsas ? (
            <>
              <input className="in-cell" style={{ width: 64 }} type="number" inputMode="numeric"
                value={bolsasMover} onChange={(e) => setBolsasMover(e.target.value)} />
              <small className="picker-hint">de {l.bolsas} bolsas</small>
            </>
          ) : null}
          {config.numeroConteineres > 1 ? (
            Array.from({ length: config.numeroConteineres }, (_, i) => i + 1).map((num) => (
              <button key={num} className="btn" onClick={() => mover(num)}>cont. {num}</button>
            ))
          ) : (
            <button className="btn btn-primary" onClick={() => mover(1)}>Mover</button>
          )}
          <button className="btn btn-ghost" onClick={() => setMovendo(false)}>cancelar</button>
        </div>
      ) : contaminando ? (
        <div className="picker">
          <span>Contaminação:</span>
          <input className="in-cell" style={{ width: 56 }} type="number" inputMode="numeric" placeholder="bolsas"
            value={qtdCont} onChange={(e) => setQtdCont(e.target.value)} />
          <select className="in-cell sel" value={causaCont} onChange={(e) => setCausaCont(e.target.value as CausaContaminacao)}>
            {CAUSAS.map((c) => <option key={c} value={c}>{rotuloCausa(c)}</option>)}
          </select>
          <button className="btn" onClick={confirmarCont}>Registrar</button>
          <button className="btn btn-ghost" onClick={() => setContaminando(false)}>cancelar</button>
        </div>
      ) : (
        <div className="lote-actions">
          {(l.tipo === 'composto' || l.tipo === 'spawn') && l.etapa !== 'pronto' && (
            <button className="btn btn-primary" disabled={ocupado} onClick={() => agir(() => loteMarcarPronto(l))}>
              Marcar pronto
            </button>
          )}
          {l.tipo === 'producao' && l.etapa === 'colonizando' && (
            <button className="btn btn-primary" disabled={ocupado} onClick={abrirMover}>
              Mover p/ contêiner
            </button>
          )}
          {l.tipo === 'producao' && l.etapa === 'frutificando' && (
            <button className="btn" disabled={ocupado} onClick={() => agir(() => loteEncerrar(l))}>Encerrar</button>
          )}
          {l.tipo === 'producao' && (l.etapa === 'colonizando' || l.etapa === 'frutificando') && (
            <button className="btn btn-ghost" disabled={ocupado} onClick={() => setContaminando(true)}>Contaminação</button>
          )}
          <button className="btn btn-ghost" disabled={ocupado}
            onClick={() => { if (confirm('Cancelar este lote? O consumo de estoque será estornado.')) agir(() => loteCancelar(l)) }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

// aba de lotes
function AbaLotes() {
  const { config } = useConfig()
  const { lotes, saldos, novoLote } = useDados()
  const pesoPadrao = (t: TipoLote) => (t === 'spawn' ? config.pesoBolsaSpawnKg : config.pesoBolsaSubstratoKg)
  const [tipo, setTipo] = useState<TipoLote>('producao')
  const [valor, setValor] = useState('100')
  const [pesoBolsa, setPesoBolsa] = useState(pesoPadrao('producao'))
  const [dataInicio, setDataInicio] = useState(hojeISO())
  const [ocupado, setOcupado] = useState(false)

  const trocarTipo = (t: TipoLote) => { setTipo(t); setPesoBolsa(pesoPadrao(t)) }

  const emBolsas = tipo !== 'composto'
  const n = Number(valor) || 0
  const kg = emBolsas ? n * (pesoBolsa || 0) : n
  const bolsas = emBolsas ? Math.round(n) : null
  const dataRef = dataInicio ? new Date(dataInicio + 'T12:00:00') : undefined
  const retroativa = !!dataInicio && dataInicio !== hojeISO()
  const proximoCodigo = gerarCodigoLote(tipo, lotes, dataRef)

  let previa = ''
  let insuf = false
  if (tipo === 'composto') {
    previa = `Produz ${fmt(kg, 0)} kg de substrato quando ficar pronto. Sem consumo de estoque agora.`
  } else if (tipo === 'spawn') {
    const sorgo = kg * config.sorgoSecoPorSpawn
    const clMl = kg * (config.clNoSorgoPct / 100) * 1000
    insuf = sorgo > saldos.sorgo_seco || clMl > saldos.cl_f2
    previa = `Consome ${fmt(sorgo)} kg de sorgo seco e ${fmt(clMl, 0)} mL de CL F2 · rende ${fmt(kg, 0)} kg de spawn.`
  } else {
    const spawn = kg * (config.spawnNoSubstratoPct / 100)
    insuf = kg > saldos.substrato || spawn > saldos.spawn
    previa = `Consome ${fmt(kg, 0)} kg de substrato e ${fmt(spawn)} kg de spawn.`
  }

  const criar = async () => {
    if (kg <= 0) return
    setOcupado(true); const erro = await novoLote(tipo, kg, bolsas, retroativa ? dataRef : undefined); setOcupado(false)
    if (erro) alert(erro)
  }

  const ativos = lotes.filter(emAndamento)
  const concluidos = lotes.filter((l) => !emAndamento(l))

  return (
    <>
      <div className="card">
        <div className="section-title">Novo lote</div>
        <div className="section-sub">Criar um lote gera automaticamente a baixa de estoque correspondente.</div>

        <div className="seg" style={{ marginBottom: 16 }}>
          <button className={tipo === 'composto' ? 'on' : ''} onClick={() => trocarTipo('composto')}>Composto</button>
          <button className={tipo === 'spawn' ? 'on' : ''} onClick={() => trocarTipo('spawn')}>Spawn</button>
          <button className={tipo === 'producao' ? 'on' : ''} onClick={() => trocarTipo('producao')}>Produção</button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <div className="num-field" style={{ flex: 1, minWidth: 150 }}>
            <label>Quantidade</label>
            <div className="num-wrap">
              <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
              <span className="unit">{emBolsas ? 'bolsas' : 'kg'}</span>
            </div>
          </div>
          {emBolsas && (
            <div className="num-field" style={{ flex: 1, minWidth: 150 }}>
              <label>Peso por bolsa</label>
              <div className="num-wrap">
                <input type="number" inputMode="decimal" step={0.5} value={pesoBolsa}
                  onChange={(e) => setPesoBolsa(Number(e.target.value))} />
                <span className="unit">kg</span>
              </div>
            </div>
          )}
        </div>

        <div className="num-field" style={{ maxWidth: 220, marginBottom: 6 }}>
          <label>Data de início {retroativa && <span className="tag-retro">retroativa</span>}</label>
          <input className="in-cell" type="date" max={hojeISO()} value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)} />
        </div>

        <div className="codigo-lote">Código do lote: <b>{proximoCodigo}</b>{emBolsas ? ` · total ${fmt(kg, 0)} kg` : ''}</div>

        <div className="preview-box">{previa}</div>
        {insuf && <div className="aviso">Estoque atual não cobre esse consumo. Você pode registrar entrada no Estoque antes.</div>}

        <div className="save-bar">
          <button className="btn btn-primary" disabled={ocupado || kg <= 0} onClick={criar}>
            {ocupado ? 'Criando…' : 'Criar lote'}
          </button>
        </div>
      </div>

      <div className="group-label">Em andamento ({ativos.length})</div>
      {ativos.length === 0 ? (
        <div className="empty-note">Nenhum lote em andamento. Crie o primeiro acima.</div>
      ) : (
        ativos.map((l) => <LoteItem key={l.id} l={l} />)
      )}

      {concluidos.length > 0 && (
        <details className="concluidos">
          <summary>Ver concluídos e cancelados ({concluidos.length})</summary>
          <div style={{ marginTop: 10 }}>
            {concluidos.slice(0, 40).map((l) => (
              <div key={l.id} className={`mov-row ${l.cancelado_em ? 'cancelado' : ''}`}>
                <div className="mov-main">
                  <div className="mov-item">{rotuloTipoLote(l.tipo)} · {fmt(l.quantidade_kg, 0)} kg</div>
                  <div className="mov-sub">{l.codigo} · {l.cancelado_em ? 'cancelado' : rotuloEtapa(l.etapa)} · {fmtData(l.iniciado_em)}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  )
}

// aba de estoque
const OPCOES_MOV: { label: string; tipo: 'compra' | 'perda' | 'ajuste'; sinal: 1 | -1 }[] = [
  { label: 'Entrada (+)', tipo: 'compra', sinal: 1 },
  { label: 'Perda (−)', tipo: 'perda', sinal: -1 },
  { label: 'Ajuste (+)', tipo: 'ajuste', sinal: 1 },
  { label: 'Ajuste (−)', tipo: 'ajuste', sinal: -1 },
]

function AbaEstoque() {
  const { saldos, movimentacoes, lotes, novaMovimentacao, cancelarMov } = useDados()
  const [item, setItem] = useState<ItemEstoque>('sorgo_seco')
  const [opc, setOpc] = useState(0)
  const [valor, setValor] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const codigoLote: Record<number, string> = Object.fromEntries(lotes.map((l) => [l.id, l.codigo]))

  const registrar = async () => {
    const mag = Math.abs(Number(valor) || 0)
    if (mag <= 0) return
    const o = OPCOES_MOV[opc]
    setOcupado(true)
    const erro = await novaMovimentacao(item, mag * o.sinal, o.tipo)
    setOcupado(false)
    if (erro) alert(erro); else setValor('')
  }

  return (
    <>
      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        {ITENS_ESTOQUE.map((it) => {
          const saldo = saldos[it.id]
          return (
            <div className="metric" key={it.id}>
              <div className="metric-label">{it.nome}</div>
              <div className="metric-value tnum" style={{ color: saldo < 0 ? 'var(--danger)' : undefined }}>
                {fmt(saldo, 0)}<span className="metric-unit">{it.unidade}</span>
              </div>
              <div className="metric-foot">saldo atual</div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="section-title">Nova movimentação</div>
        <div className="section-sub">Entradas manuais, perdas e ajustes. Consumo e produção por lotes são automáticos.</div>
        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div className="num-field">
            <label>Item</label>
            <select className="select" value={item} onChange={(e) => setItem(e.target.value as ItemEstoque)}>
              {ITENS_ESTOQUE.map((it) => <option key={it.id} value={it.id}>{it.nome}</option>)}
            </select>
          </div>
          <div className="num-field">
            <label>Tipo</label>
            <select className="select" value={opc} onChange={(e) => setOpc(Number(e.target.value))}>
              {OPCOES_MOV.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
            </select>
          </div>
          <div className="num-field">
            <label>Quantidade</label>
            <div className="num-wrap">
              <input type="number" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
              <span className="unit">{unidadeItem(item)}</span>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={ocupado} onClick={registrar}>
          {ocupado ? 'Registrando…' : 'Registrar'}
        </button>
      </div>

      <div className="group-label">Movimentações</div>
      <div className="card">
        {movimentacoes.length === 0 ? (
          <div className="empty-note">Nenhuma movimentação ainda.</div>
        ) : (
          movimentacoes.slice(0, 40).map((m) => {
            const pos = Number(m.quantidade) >= 0
            const manual = m.lote_id == null
            return (
              <div key={m.id} className={`mov-row ${m.cancelado_em ? 'cancelado' : ''}`}>
                <div className="mov-main">
                  <div className="mov-item">{nomeItem(m.item)}</div>
                  <div className="mov-sub">
                    {ROTULO_TIPO[m.tipo]} · {fmtData(m.criado_em)}
                    {m.lote_id ? ` · lote ${codigoLote[m.lote_id] ?? m.lote_id}` : ''}
                    {m.cancelado_em ? ' · cancelada' : ''}
                  </div>
                </div>
                <span className={`mov-qty ${pos ? 'pos' : 'neg'}`}>{pos ? '+' : ''}{fmt(Number(m.quantidade))} {unidadeItem(m.item)}</span>
                {!m.cancelado_em && manual && (
                  <button className="mov-cancel-btn"
                    onClick={() => { if (confirm('Cancelar esta movimentação?')) cancelarMov(m.id) }}>
                    cancelar
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export default function Producao() {
  const { carregando } = useDados()
  const [aba, setAba] = useState<'lotes' | 'estoque'>('lotes')

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Produção</h1>
        <p className="page-desc">Lotes em andamento e saldo de estoque. Tudo com histórico — nada é apagado.</p>
      </div>

      {!supabaseConfigured && (
        <div className="auth-error" style={{ marginBottom: 14 }}>
          Supabase não configurado — registre as tabelas e as credenciais para usar estoque e lotes (veja o README).
        </div>
      )}

      <div className="seg tabs-bar">
        <button className={aba === 'lotes' ? 'on' : ''} onClick={() => setAba('lotes')}>Lotes</button>
        <button className={aba === 'estoque' ? 'on' : ''} onClick={() => setAba('estoque')}>Estoque</button>
      </div>

      {carregando ? <div className="empty-note">Carregando…</div> : aba === 'lotes' ? <AbaLotes /> : <AbaEstoque />}
    </>
  )
}
