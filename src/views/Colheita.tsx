import { useState } from 'react'
import { useConfig } from '../context/ConfigContext'
import { useDados } from '../context/DadosContext'
import { supabaseConfigured } from '../lib/supabase'
import { producaoNoPeriodo, ROTULO_TURNO, type Turno } from '../lib/colheita'

const fmt = (n: number, dec = 1) =>
  (isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function inicioDoDia(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function diasAtras(n: number): Date { return new Date(Date.now() - n * 86400000) }

export default function Colheita() {
  const { config } = useConfig()
  const { colheitas, lotes, eficienciaBiologica, novaColheita, cancelarColh, carregando } = useDados()

  const frutificando = new Set(
    lotes.filter((l) => !l.cancelado_em && l.tipo === 'producao' && l.etapa === 'frutificando').map((l) => l.conteiner),
  )

  const [conteiner, setConteiner] = useState(1)
  const [peso, setPeso] = useState('')
  const [turno, setTurno] = useState<Turno | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const registrar = async () => {
    const kg = Number(peso) || 0
    if (kg <= 0) return
    setOcupado(true)
    const erro = await novaColheita(conteiner, kg, turno)
    setOcupado(false)
    if (erro) alert(erro); else setPeso('')
  }

  const hoje = producaoNoPeriodo(colheitas, inicioDoDia())
  const sete = producaoNoPeriodo(colheitas, diasAtras(7))
  const trinta = producaoNoPeriodo(colheitas, diasAtras(30))
  const nConteineres = Math.max(1, config.numeroConteineres)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Colheita</h1>
        <p className="page-desc">Registro contínuo por contêiner. Alimenta a produção e a eficiência biológica.</p>
      </div>

      {!supabaseConfigured && (
        <div className="auth-error" style={{ marginBottom: 14 }}>
          Supabase não configurado — registre as tabelas e credenciais para salvar colheitas (veja o README).
        </div>
      )}

      <div className="grid grid-metrics" style={{ marginBottom: 14 }}>
        <div className="metric">
          <div className="metric-label">Hoje</div>
          <div className="metric-value tnum">{fmt(hoje, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">colhido no dia</div>
        </div>
        <div className="metric">
          <div className="metric-label">7 dias</div>
          <div className="metric-value tnum">{fmt(sete, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">última semana</div>
        </div>
        <div className="metric">
          <div className="metric-label">30 dias</div>
          <div className="metric-value tnum">{fmt(trinta, 1)}<span className="metric-unit">kg</span></div>
          <div className="metric-foot">último mês</div>
        </div>
        <div className="metric">
          <div className="metric-label">Eficiência biológica</div>
          <div className={`metric-value tnum ${eficienciaBiologica == null ? 'empty' : ''}`}>
            {eficienciaBiologica == null ? '—' : fmt(eficienciaBiologica, 0)}
            {eficienciaBiologica != null && <span className="metric-unit">%</span>}
          </div>
          <div className="metric-foot">agregada · meta {config.beAlvoPct}%</div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Nova colheita</div>
        <div className="section-sub">Peso fresco colhido nesta sessão. Registre a cada colheita do dia.</div>

        {nConteineres > 1 && (
          <div className="num-field" style={{ marginBottom: 14 }}>
            <label>Contêiner</label>
            <div className="seg">
              {Array.from({ length: nConteineres }, (_, i) => i + 1).map((num) => (
                <button key={num} className={conteiner === num ? 'on' : ''} onClick={() => setConteiner(num)}>
                  {num}{frutificando.has(num) ? ' •' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="num-field" style={{ flex: 1, minWidth: 150 }}>
            <label>Peso colhido</label>
            <div className="num-wrap">
              <input type="number" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="0" />
              <span className="unit">kg</span>
            </div>
          </div>
          <div className="num-field">
            <label>Turno (opcional)</label>
            <div className="seg">
              <button className={turno === 'manha' ? 'on' : ''} onClick={() => setTurno(turno === 'manha' ? null : 'manha')}>Manhã</button>
              <button className={turno === 'tarde' ? 'on' : ''} onClick={() => setTurno(turno === 'tarde' ? null : 'tarde')}>Tarde</button>
            </div>
          </div>
        </div>

        {frutificando.size === 0 && (
          <div className="preview-box">Nenhum lote frutificando agora. Você ainda pode registrar, mas confira se é o esperado.</div>
        )}

        <div className="save-bar">
          <button className="btn btn-primary" disabled={ocupado || !(Number(peso) > 0)} onClick={registrar}>
            {ocupado ? 'Registrando…' : 'Registrar colheita'}
          </button>
        </div>
      </div>

      <div className="group-label">Colheitas recentes</div>
      <div className="card">
        {carregando ? (
          <div className="empty-note">Carregando…</div>
        ) : colheitas.length === 0 ? (
          <div className="empty-note">Nenhuma colheita registrada ainda.</div>
        ) : (
          colheitas.slice(0, 40).map((c) => (
            <div key={c.id} className={`mov-row ${c.cancelado_em ? 'cancelado' : ''}`}>
              <div className="mov-main">
                <div className="mov-item">Contêiner {c.conteiner}{c.turno ? ` · ${ROTULO_TURNO[c.turno]}` : ''}</div>
                <div className="mov-sub">{fmtDataHora(c.colhido_em)}{c.cancelado_em ? ' · cancelada' : ''}</div>
              </div>
              <span className="mov-qty pos">{fmt(Number(c.peso_kg))} kg</span>
              {!c.cancelado_em && (
                <button className="mov-cancel-btn"
                  onClick={() => { if (confirm('Cancelar esta colheita?')) cancelarColh(c.id) }}>
                  cancelar
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
