import type { Config } from './calculos'
import { tetoSustentavel } from './calculos'
import type { Lote } from './lotes'
import { ocupacaoConteinerKg, ocupacaoIncubacaoKg } from './lotes'
import type { ItemEstoque } from './estoque'
import type { Ponto } from './indicadores'

const DIA = 86400000
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

type Saldos = Record<ItemEstoque, number>

// Ocupação do contêiner (kg) projetada para daqui a N dias, considerando só o
// pipeline atual: o que já está frutificando (sai no fim) e o que está
// colonizando (entra quando termina e fica o tempo de frutificação).
export function ocupacaoConteinerProjetada(lotes: Lote[], c: Config, diasAdiante: number): number {
  const alvo = Date.now() + diasAdiante * DIA
  let kg = 0
  for (const l of lotes) {
    if (l.cancelado_em || l.tipo !== 'producao' || !l.previsto_para) continue
    if (l.etapa === 'frutificando') {
      if (alvo < new Date(l.previsto_para).getTime()) kg += Number(l.quantidade_kg)
    } else if (l.etapa === 'colonizando') {
      const entra = new Date(l.previsto_para).getTime()
      const sai = entra + c.tempoFrutificacao * DIA
      if (alvo >= entra && alvo < sai) kg += Number(l.quantidade_kg)
    }
  }
  return kg
}

export type Diagnostico = {
  ocupacaoKg: number; ocupacaoPct: number
  tetoKg: number; tetoPct: number; folgaKg: number
  status: 'abaixo' | 'no_teto' | 'acima'; gargalo: string
  incubacaoKg: number; incubacaoCapKg: number
}

export function diagnostico(lotes: Lote[], c: Config): Diagnostico {
  const t = tetoSustentavel(c)
  const capC = c.numeroConteineres * c.capacidadeConteinerKg
  const ocC = ocupacaoConteinerKg(lotes)
  const tetoKg = (capC * t.tetoPct) / 100
  const folga = tetoKg - ocC
  const margem = capC * 0.02
  const status: Diagnostico['status'] = folga > margem ? 'abaixo' : folga < -margem ? 'acima' : 'no_teto'
  return {
    ocupacaoKg: ocC, ocupacaoPct: capC ? (ocC / capC) * 100 : 0,
    tetoKg, tetoPct: t.tetoPct, folgaKg: folga, status, gargalo: t.gargalo,
    incubacaoKg: ocupacaoIncubacaoKg(lotes, c), incubacaoCapKg: c.numeroIncubadoras * c.capacidadeIncubacaoKg,
  }
}

export type PlanoInicio = {
  producaoKg: number
  limitante: 'teto' | 'incubacao' | 'substrato' | 'spawn' | 'nada'
  consumoSubstrato: number; consumoSpawn: number
  prepararSpawnKg: number; prepararCompostoKg: number
}

// Quanto de substrato inocular hoje para manter o contêiner no teto, respeitando
// a sala de incubação (o gargalo) e o estoque. É a "corda" do Tambor-Pulmão-Corda.
export function planoInicio(lotes: Lote[], c: Config, saldos: Saldos): PlanoInicio {
  const d = diagnostico(lotes, c)
  const salaLivre = Math.max(0, d.incubacaoCapKg - d.incubacaoKg)
  const capIncub = c.fatorOcupacaoSubstrato > 0 ? salaLivre / c.fatorOcupacaoSubstrato : 0
  // Sala no contêiner no momento em que o lote de hoje chegaria (após a colonização).
  const salaConteiner = Math.max(0, d.tetoKg - ocupacaoConteinerProjetada(lotes, c, c.tempoColonizacao))
  const desejado = Math.min(salaConteiner, capIncub) // o que a capacidade real permite iniciar
  const spawnPermite = c.spawnNoSubstratoPct > 0 ? saldos.spawn / (c.spawnNoSubstratoPct / 100) : Infinity
  const producaoKg = Math.max(0, Math.min(desejado, saldos.substrato, spawnPermite))

  let limitante: PlanoInicio['limitante']
  if (desejado <= 0.5) {
    limitante = salaConteiner <= 0.5 ? 'nada' : 'incubacao'
  } else {
    const menor = Math.min(desejado, saldos.substrato, spawnPermite)
    if (menor === saldos.substrato && saldos.substrato < desejado) limitante = 'substrato'
    else if (menor === spawnPermite && spawnPermite < desejado) limitante = 'spawn'
    else limitante = salaConteiner <= capIncub ? 'teto' : 'incubacao'
  }

  // Para não travar por estoque: o que preparar agora (lead de ~14 dias) para
  // conseguir iniciar tudo o que a capacidade permite.
  const prepararCompostoKg = Math.max(0, desejado - saldos.substrato)
  const prepararSpawnKg = Math.max(0, desejado * (c.spawnNoSubstratoPct / 100) - saldos.spawn)

  return {
    producaoKg, limitante,
    consumoSubstrato: producaoKg, consumoSpawn: producaoKg * (c.spawnNoSubstratoPct / 100),
    prepararSpawnKg, prepararCompostoKg,
  }
}

// Primeiro dia (a partir de hoje) em que a projeção cai abaixo do teto.
// 0 = já abaixo agora; null = sem teto definido.
export function diasSustentandoTeto(lotes: Lote[], c: Config): number | null {
  const d = diagnostico(lotes, c)
  if (d.tetoKg <= 0) return null
  for (let dia = 0; dia <= 120; dia++) {
    if (ocupacaoConteinerProjetada(lotes, c, dia) < d.tetoKg * 0.999) return dia
  }
  return 120
}

// Série da projeção da ocupação do contêiner (kg) para o gráfico.
export function serieProjecao(lotes: Lote[], c: Config, dias = 63, passo = 7): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= dias; i += passo) {
    pontos.push({ label: ddmm(new Date(Date.now() + i * DIA)), valor: Math.round(ocupacaoConteinerProjetada(lotes, c, i)) })
  }
  return pontos
}

// Projeção com uma linha por lote, ACUMULATIVA (empilhada): cada linha soma a
// sua contribuição às dos lotes anteriores. Assim a linha mais alta é sempre a
// ocupação total prevista, e a faixa entre duas linhas é o lote daquela faixa.
export function serieProjecaoPorLote(
  lotes: Lote[], c: Config, dias = 63, passo = 7,
): { series: { nome: string; pontos: Ponto[] }[]; total: Ponto[] } {
  const passos: number[] = []
  for (let i = 0; i <= dias; i += passo) passos.push(i)
  const rotulo = (i: number) => ddmm(new Date(Date.now() + i * DIA))

  const itens: { l: Lote; contrib: (dia: number) => number }[] = []
  for (const l of lotes) {
    if (l.cancelado_em || l.tipo !== 'producao' || !l.previsto_para) continue
    const kg = Number(l.quantidade_kg)
    if (l.etapa === 'frutificando') {
      const sai = (new Date(l.previsto_para).getTime() - Date.now()) / DIA
      itens.push({ l, contrib: (dia) => (dia < sai ? kg : 0) })
    } else if (l.etapa === 'colonizando') {
      const entra = (new Date(l.previsto_para).getTime() - Date.now()) / DIA
      const sai = entra + c.tempoFrutificacao
      itens.push({ l, contrib: (dia) => (dia >= entra && dia < sai ? kg : 0) })
    }
  }
  const ativos = itens.filter((it) => passos.some((d) => it.contrib(d) > 0))

  // Empilha: a série do lote i é a soma das contribuições dos lotes 0..i.
  const acumulado = passos.map(() => 0)
  const series = ativos.map((it) => {
    const pontos = passos.map((d, k) => {
      acumulado[k] += it.contrib(d)
      return { label: rotulo(d), valor: Math.round(acumulado[k]) }
    })
    return { nome: it.l.codigo, pontos }
  })
  const total: Ponto[] = passos.map((d, k) => ({ label: rotulo(d), valor: Math.round(acumulado[k]) }))
  return { series, total }
}
