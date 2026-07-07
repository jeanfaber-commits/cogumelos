// =========================================================================
// Motor de cálculo — funções puras, determinísticas, sem efeitos colaterais.
// Toda a lógica de produção vive aqui. Recebe a configuração e devolve números.
// Fácil de ler, conferir na mão e ajustar.
// =========================================================================

export type Ingrediente = {
  nome: string
  materiaSecaPct: number // % sobre a matéria seca da receita
  umidadePct: number     // umidade do ingrediente como é recebido
}

export type Config = {
  // Capacidades
  numeroConteineres: number
  capacidadeConteinerKg: number   // por contêiner
  numeroIncubadoras: number
  capacidadeIncubacaoKg: number   // por sala, em kg-equivalente
  pasteurizacaoLoteKg: number
  pasteurizacaoVezesSemana: number

  // Pesos e fatores de ocupação
  pesoBolsaSubstratoKg: number
  pesoBolsaSpawnKg: number
  fatorOcupacaoSpawn: number      // bolsa de spawn ocupa Nx o peso físico
  fatorOcupacaoSubstrato: number  // bolsa de substrato ocupa Nx o peso físico

  // Tempos das etapas (dias)
  tempoMultiplicacaoCL: number
  tempoPreparoComposto: number
  tempoSpawn: number
  tempoColonizacao: number
  tempoFrutificacao: number
  tempoPasteurizacao: number

  // Perdas médias por etapa (%)
  contaminacaoSpawnPct: number
  contaminacaoColonizacaoPct: number

  // Receitas e coeficientes
  clNoSorgoPct: number            // CL F2 sobre o peso úmido do sorgo
  spawnNoSubstratoPct: number     // spawn sobre o peso úmido do substrato
  sorgoSecoPorSpawn: number       // kg de sorgo seco por kg de spawn
  umidadeAlvoSubstratoPct: number // umidade do substrato pronto
  beAlvoPct: number               // eficiência biológica alvo

  // Receita do composto
  ingredientesComposto: Ingrediente[]
}

// ---- Coeficiente de ocupação da incubação por kg/dia de substrato inoculado ----
// Cada kg/dia de substrato inoculado gera, em regime, uma ocupação fixa na
// incubação: a parte do próprio substrato colonizando + a parte do spawn que
// precisou ser produzido para inoculá-lo (o spawn ocupa o dobro do peso).
export function coefIncubacao(c: Config): number {
  const fracSpawn = 1 - c.contaminacaoSpawnPct / 100
  const taxaSpawn = c.spawnNoSubstratoPct / 100
  return (
    c.tempoColonizacao * c.fatorOcupacaoSubstrato +
    (taxaSpawn / fracSpawn) * c.tempoSpawn * c.fatorOcupacaoSpawn
  )
}

export type Gargalo = 'incubacao' | 'pasteurizacao' | 'conteiner'

export type ResultadoTeto = {
  tetoPct: number
  gargalo: Gargalo
  limites: { incubacaoPct: number; pasteurizacaoPct: number; conteinerPct: number }
  substratoInoculadoDia: number  // kg/dia no teto
  producaoPrevistaDia: number    // kg de cogumelo/dia no teto (via BE)
}

// ---- Teto sustentável de ocupação, e qual recurso é a restrição ativa ----
// Puxa a partir do contêiner: para cada fração de ocupação f, calcula a taxa
// de substrato inoculado necessária e vê qual recurso satura primeiro.
export function tetoSustentavel(c: Config): ResultadoTeto {
  const capC = c.numeroConteineres * c.capacidadeConteinerKg
  const capInc = c.numeroIncubadoras * c.capacidadeIncubacaoKg
  const capPastSemana = c.pasteurizacaoLoteKg * c.pasteurizacaoVezesSemana
  const fracColon = 1 - c.contaminacaoColonizacaoPct / 100
  const Tf = c.tempoFrutificacao
  const K = coefIncubacao(c)

  // Guarda contra divisões por zero em configurações incompletas.
  const seguro = (n: number) => (isFinite(n) && n > 0 ? n : 0)

  // Fração máxima permitida por cada restrição:
  const fInc = seguro((capInc * Tf * fracColon) / (K * capC))
  const fPast = seguro((capPastSemana * Tf * fracColon) / (7 * capC))
  const fCont = 1

  const limites = {
    incubacaoPct: fInc * 100,
    pasteurizacaoPct: fPast * 100,
    conteinerPct: 100,
  }

  const menor = Math.min(fInc, fPast, fCont)
  let gargalo: Gargalo = 'conteiner'
  if (menor === fInc && fInc <= fPast) gargalo = 'incubacao'
  else if (menor === fPast) gargalo = 'pasteurizacao'

  const R = seguro((menor * capC) / Tf / fracColon)
  const substratoQueFrutificaDia = (menor * capC) / Tf
  const massaSecaDia = substratoQueFrutificaDia * (1 - c.umidadeAlvoSubstratoPct / 100)
  const producaoPrevistaDia = massaSecaDia * (c.beAlvoPct / 100)

  return { tetoPct: menor * 100, gargalo, limites, substratoInoculadoDia: R, producaoPrevistaDia }
}

export type Necessidade = {
  substratoInoculadoDia: number
  incubacaoNecessariaKg: number
  pasteurizacaoNecessariaSemana: number
  spawnDia: number
  sorgoSecoDia: number
  clDia: number
}

// ---- Quanto de cada recurso é preciso para atingir uma meta de ocupação ----
// Responde "para chegar a X%, você precisa de tanto de incubação / vapor / insumos".
export function capacidadeNecessaria(c: Config, alvoPct: number): Necessidade {
  const capC = c.numeroConteineres * c.capacidadeConteinerKg
  const fracColon = 1 - c.contaminacaoColonizacaoPct / 100
  const fracSpawn = 1 - c.contaminacaoSpawnPct / 100
  const K = coefIncubacao(c)
  const R = ((alvoPct / 100) * capC) / c.tempoFrutificacao / fracColon
  const spawnDia = (R * (c.spawnNoSubstratoPct / 100)) / fracSpawn
  return {
    substratoInoculadoDia: R,
    incubacaoNecessariaKg: K * R,
    pasteurizacaoNecessariaSemana: R * 7,
    spawnDia,
    sorgoSecoDia: spawnDia * c.sorgoSecoPorSpawn,
    clDia: spawnDia * (c.clNoSorgoPct / 100),
  }
}

// ---- Calculadora do composto ----
// A partir da quantidade alvo de substrato pronto (a 60% de umidade), calcula
// o peso úmido de cada ingrediente e a água a adicionar para fechar a umidade.
export type LinhaComposto = { nome: string; secoKg: number; umidoKg: number }
export type ResultadoComposto = {
  linhas: LinhaComposto[]
  massaSecaKg: number
  somaUmidaKg: number
  aguaAdicionarKg: number
  totalKg: number
  somaMateriaSecaPct: number
  aviso?: string
}

export function calcularComposto(c: Config, alvoUmidoKg: number): ResultadoComposto {
  const massaSeca = alvoUmidoKg * (1 - c.umidadeAlvoSubstratoPct / 100)
  const linhas = c.ingredientesComposto.map((ing) => {
    const seco = massaSeca * (ing.materiaSecaPct / 100)
    const umido = seco / (1 - ing.umidadePct / 100)
    return { nome: ing.nome, secoKg: seco, umidoKg: umido }
  })
  const somaUmida = linhas.reduce((s, l) => s + l.umidoKg, 0)
  const agua = alvoUmidoKg - somaUmida
  const somaMS = c.ingredientesComposto.reduce((s, i) => s + i.materiaSecaPct, 0)

  let aviso: string | undefined
  if (Math.abs(somaMS - 100) > 0.1)
    aviso = `As proporções da receita somam ${somaMS.toFixed(1)}%, não 100%.`
  else if (agua < 0)
    aviso = 'Os ingredientes já trazem mais água que o alvo — reduza alguma umidade.'

  return {
    linhas,
    massaSecaKg: massaSeca,
    somaUmidaKg: somaUmida,
    aguaAdicionarKg: agua,
    totalKg: alvoUmidoKg,
    somaMateriaSecaPct: somaMS,
    aviso,
  }
}

// ---- Calculadora do spawn ----
export type ResultadoSpawn = { sorgoSecoKg: number; clF2Kg: number; bolsas: number }
export function calcularSpawn(c: Config, alvoSpawnKg: number): ResultadoSpawn {
  return {
    sorgoSecoKg: alvoSpawnKg * c.sorgoSecoPorSpawn,
    clF2Kg: alvoSpawnKg * (c.clNoSorgoPct / 100),
    bolsas: c.pesoBolsaSpawnKg > 0 ? alvoSpawnKg / c.pesoBolsaSpawnKg : 0,
  }
}
