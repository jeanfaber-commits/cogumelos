import { useConfig } from '../context/ConfigContext'
import type { Config, ResultadoTeto } from '../lib/calculos'

const fmt = (n: number, dec = 0) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })

const NOME_GARGALO: Record<string, string> = {
  incubacao: 'sala de incubação',
  pasteurizacao: 'pasteurização (vapor)',
  conteiner: 'contêiner',
}

// Campo numérico ligado a um parâmetro da configuração.
function Num({
  label, chave, unit, step = 1,
}: { label: string; chave: keyof Config; unit: string; step?: number }) {
  const { config, atualizar } = useConfig()
  const valor = config[chave] as number
  return (
    <div className="num-field">
      <label>{label}</label>
      <div className="num-wrap">
        <input
          type="number" inputMode="decimal" step={step}
          value={Number.isFinite(valor) ? valor : ''}
          onChange={(e) =>
            atualizar({ [chave]: e.target.value === '' ? 0 : Number(e.target.value) } as Partial<Config>)}
        />
        <span className="unit">{unit}</span>
      </div>
    </div>
  )
}

export default function Configuracoes() {
  const ctx = useConfig() as ReturnType<typeof useConfig> & { teto: ResultadoTeto }
  const { config, salvar, restaurarPadrao, estado, mensagem, persistencia, teto } = ctx

  const barra = (pct: number, bind: boolean) => (
    <div className="limit-bar">
      <div className={`limit-fill ${bind ? 'bind' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Configurações</h1>
        <p className="page-desc">Variáveis dos cálculos e capacidades. O teto se recalcula sozinho a cada mudança.</p>
      </div>

      {/* Teto sustentável (ao vivo) */}
      <div className="teto-panel" style={{ marginBottom: 14 }}>
        <div className="teto-top">
          <span className="teto-value tnum">{fmt(teto.tetoPct)}%</span>
          <span className="teto-label">
            teto de ocupação, limitado pela <b>{NOME_GARGALO[teto.gargalo]}</b>
            {' · '}produção prevista no teto ~<b>{fmt(teto.producaoPrevistaDia)} kg/dia</b>
          </span>
        </div>
        <div className="limit-row">
          <span className="limit-name">Sala de incubação</span>
          {barra(teto.limites.incubacaoPct, teto.gargalo === 'incubacao')}
          <span className={`limit-val ${teto.gargalo === 'incubacao' ? 'bind' : ''}`}>{fmt(teto.limites.incubacaoPct)}%</span>
        </div>
        <div className="limit-row">
          <span className="limit-name">Pasteurização</span>
          {barra(teto.limites.pasteurizacaoPct, teto.gargalo === 'pasteurizacao')}
          <span className={`limit-val ${teto.gargalo === 'pasteurizacao' ? 'bind' : ''}`}>{fmt(teto.limites.pasteurizacaoPct)}%</span>
        </div>
        <div className="limit-row">
          <span className="limit-name">Contêiner</span>
          {barra(100, teto.gargalo === 'conteiner')}
          <span className={`limit-val ${teto.gargalo === 'conteiner' ? 'bind' : ''}`}>100%</span>
        </div>
        <div className="help">
          Cada barra é o máximo de ocupação que aquele recurso permite. O menor deles é o teto real.
          Aumente a capacidade do recurso limitante para o teto subir.
        </div>
      </div>

      {/* Capacidades */}
      <div className="card">
        <div className="section-title">Capacidades</div>
        <div className="section-sub">Editáveis a qualquer momento — é aqui que você reconfigura o sistema.</div>
        <div className="form-grid">
          <Num label="Contêineres" chave="numeroConteineres" unit="un" />
          <Num label="Capacidade por contêiner" chave="capacidadeConteinerKg" unit="kg" step={100} />
          <Num label="Salas de incubação" chave="numeroIncubadoras" unit="un" />
          <Num label="Capacidade por incubação" chave="capacidadeIncubacaoKg" unit="kg" step={100} />
          <Num label="Pasteurização — lote" chave="pasteurizacaoLoteKg" unit="kg" step={50} />
          <Num label="Pasteurização — vezes/semana" chave="pasteurizacaoVezesSemana" unit="x" />
        </div>
      </div>

      {/* Pesos e fatores */}
      <div className="card">
        <div className="section-title">Pesos e ocupação</div>
        <div className="section-sub">Peso das bolsas e quanto cada uma ocupa na incubação.</div>
        <div className="form-grid">
          <Num label="Bolsa de substrato" chave="pesoBolsaSubstratoKg" unit="kg" step={0.5} />
          <Num label="Bolsa de spawn" chave="pesoBolsaSpawnKg" unit="kg" step={0.5} />
          <Num label="Fator ocupação — substrato" chave="fatorOcupacaoSubstrato" unit="x" step={0.5} />
          <Num label="Fator ocupação — spawn" chave="fatorOcupacaoSpawn" unit="x" step={0.5} />
        </div>
      </div>

      {/* Tempos */}
      <div className="card">
        <div className="section-title">Tempos das etapas</div>
        <div className="section-sub">Duração média de cada etapa, em dias.</div>
        <div className="form-grid">
          <Num label="Multiplicação da CL" chave="tempoMultiplicacaoCL" unit="dias" />
          <Num label="Preparo do composto" chave="tempoPreparoComposto" unit="dias" />
          <Num label="Spawn (incubação)" chave="tempoSpawn" unit="dias" />
          <Num label="Colonização" chave="tempoColonizacao" unit="dias" />
          <Num label="Frutificação" chave="tempoFrutificacao" unit="dias" />
          <Num label="Pasteurização" chave="tempoPasteurizacao" unit="dias" />
        </div>
      </div>

      {/* Contaminação */}
      <div className="card">
        <div className="section-title">Contaminação</div>
        <div className="section-sub">Perdas médias por etapa. Idealmente a média real observada ao longo do tempo.</div>
        <div className="form-grid">
          <Num label="Spawn" chave="contaminacaoSpawnPct" unit="%" />
          <Num label="Colonização" chave="contaminacaoColonizacaoPct" unit="%" />
        </div>
      </div>

      {/* Spawn e substrato */}
      <div className="card">
        <div className="section-title">Spawn e substrato</div>
        <div className="section-sub">Taxas de inoculação e a meta de eficiência biológica.</div>
        <div className="form-grid">
          <Num label="CL F2 no sorgo" chave="clNoSorgoPct" unit="%" step={0.5} />
          <Num label="Spawn no substrato" chave="spawnNoSubstratoPct" unit="%" step={0.5} />
          <Num label="Sorgo seco por spawn" chave="sorgoSecoPorSpawn" unit="kg/kg" step={0.05} />
          <Num label="Umidade alvo do substrato" chave="umidadeAlvoSubstratoPct" unit="%" />
          <Num label="Eficiência biológica alvo" chave="beAlvoPct" unit="%" />
        </div>
      </div>

      {/* Salvar */}
      <div className="save-bar">
        <button className="btn btn-primary" onClick={salvar} disabled={estado === 'salvando'}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar e recalcular'}
        </button>
        <button className="btn btn-ghost" onClick={restaurarPadrao}>Restaurar padrão</button>
        {mensagem && <span className={`feedback ${estado === 'erro' ? 'erro' : 'ok'}`}>{mensagem}</span>}
        {!persistencia && !mensagem && (
          <span className="feedback erro">Supabase não configurado — dá para calcular, mas não salvar ainda.</span>
        )}
      </div>
    </>
  )
}
