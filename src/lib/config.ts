import { supabase } from './supabase'
import type { Config } from './calculos'

// Valores iniciais — exatamente os que definimos na discussão.
export const DEFAULT_CONFIG: Config = {
  numeroConteineres: 1,
  capacidadeConteinerKg: 5000,
  numeroIncubadoras: 1,
  capacidadeIncubacaoKg: 3000,
  pasteurizacaoLoteKg: 1000,
  pasteurizacaoVezesSemana: 3,

  pesoBolsaSubstratoKg: 5,
  pesoBolsaSpawnKg: 2,
  fatorOcupacaoSpawn: 2,
  fatorOcupacaoSubstrato: 1,

  tempoMultiplicacaoCL: 14,
  tempoPreparoComposto: 14,
  tempoSpawn: 14,
  tempoColonizacao: 14,
  tempoFrutificacao: 40,
  tempoPasteurizacao: 3,

  contaminacaoSpawnPct: 10,
  contaminacaoColonizacaoPct: 5,

  clNoSorgoPct: 2,
  spawnNoSubstratoPct: 5,
  sorgoSecoPorSpawn: 0.5,
  umidadeAlvoSubstratoPct: 60,
  beAlvoPct: 80,

  ingredientesComposto: [
    { nome: 'Caroço de açaí', materiaSecaPct: 50, umidadePct: 50 },
    { nome: 'Serragem', materiaSecaPct: 35, umidadePct: 50 },
    { nome: 'Farelo de arroz', materiaSecaPct: 12, umidadePct: 11 },
    { nome: 'Gesso agrícola', materiaSecaPct: 1.5, umidadePct: 2 },
    { nome: 'Calcário calcítico', materiaSecaPct: 1.5, umidadePct: 0.5 },
  ],
}

// Lê a configuração salva. Faz merge com os padrões para que, se adicionarmos
// um novo campo no futuro, configurações antigas continuem funcionando.
export async function loadConfig(): Promise<Config | null> {
  const { data, error } = await supabase
    .from('configuracao')
    .select('dados')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  return { ...DEFAULT_CONFIG, ...(data.dados as Partial<Config>) }
}

// Salva a configuração (linha única, id = 1). O histórico é gravado
// automaticamente por um gatilho no banco (ver supabase/schema.sql).
export async function saveConfig(dados: Config, userId?: string): Promise<string | null> {
  const { error } = await supabase.from('configuracao').upsert({
    id: 1,
    dados,
    atualizado_em: new Date().toISOString(),
    atualizado_por: userId ?? null,
  })
  return error?.message ?? null
}
