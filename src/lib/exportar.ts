// Exportação de gráficos (SVG) para PNG e PDF, sem bibliotecas externas.
// Estratégia: serializa o SVG resolvendo as variáveis de cor do tema, rasteriza
// num canvas e daí gera o PNG; para o PDF, embute o JPEG do canvas.

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

// Substitui var(--x) pelos valores calculados no contexto do próprio SVG (respeita o tema).
function resolverVariaveis(svgTexto: string, contexto: Element): string {
  const estilo = getComputedStyle(contexto)
  return svgTexto.replace(/var\((--[a-z0-9-]+)\)/gi, (_, nome) => estilo.getPropertyValue(nome).trim() || '#888')
}

async function svgParaCanvas(svg: SVGSVGElement, escala: number, fundo: string): Promise<HTMLCanvasElement> {
  const vb = (svg.getAttribute('viewBox') || '0 0 600 240').split(/\s+/).map(Number)
  const W = vb[2], H = vb[3]

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))
  // fundo sólido (mantém o texto legível no tema atual)
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  rect.setAttribute('x', '0'); rect.setAttribute('y', '0')
  rect.setAttribute('width', String(W)); rect.setAttribute('height', String(H))
  rect.setAttribute('fill', fundo)
  clone.insertBefore(rect, clone.firstChild)

  let texto = new XMLSerializer().serializeToString(clone)
  texto = resolverVariaveis(texto, svg)

  const blob = new Blob([texto], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok()
      img.onerror = () => erro(new Error('falha ao renderizar o gráfico'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(W * escala)
    canvas.height = Math.round(H * escala)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function corFundo(svg: Element): string {
  const v = getComputedStyle(svg).getPropertyValue('--surface').trim()
  return v || '#ffffff'
}

export async function baixarPng(svg: SVGSVGElement, nomeBase: string, escala = 2) {
  const canvas = await svgParaCanvas(svg, escala, corFundo(svg))
  await new Promise<void>((ok) => canvas.toBlob((b) => { if (b) baixarBlob(b, `${nomeBase}.png`); ok() }, 'image/png'))
}

export async function baixarPdf(svg: SVGSVGElement, nomeBase: string, titulo: string, escala = 2) {
  const canvas = await svgParaCanvas(svg, escala, corFundo(svg))
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
  const bin = atob(dataUrl.split(',')[1])
  const jpeg = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i)
  const pdf = montarPdfJpeg(jpeg, canvas.width, canvas.height, titulo)
  baixarBlob(new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' }), `${nomeBase}.pdf`)
}

// Monta um PDF A4 com um título e a imagem JPEG embutida (DCTDecode).
// Exportada para permitir teste da estrutura de bytes.
export function montarPdfJpeg(jpeg: Uint8Array, wPx: number, hPx: number, titulo: string): Uint8Array {
  const enc = new TextEncoder()
  const partes: Uint8Array[] = []
  let len = 0
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); len += b.length }
  const offsets: number[] = []
  const obj = (n: number, corpo: string) => { offsets[n] = len; push(`${n} 0 obj\n`); push(corpo); push('\nendobj\n') }

  const PW = 595.28, PH = 841.89, margem = 36
  const dispW = PW - margem * 2
  const dispH = (dispW * hPx) / wPx
  const imgY = PH - margem - 24 - dispH
  const tituloEsc = titulo.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  push('%PDF-1.3\n')
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])) // marca de conteúdo binário

  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 5 0 R >> >> /Contents 6 0 R >>`)

  offsets[4] = len
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  push(jpeg)
  push('\nendstream\nendobj\n')

  obj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  const conteudo = `BT /F1 13 Tf ${margem} ${(PH - margem - 13).toFixed(2)} Td (${tituloEsc}) Tj ET\nq ${dispW.toFixed(2)} 0 0 ${dispH.toFixed(2)} ${margem} ${imgY.toFixed(2)} cm /Im0 Do Q`
  offsets[6] = len
  push(`6 0 obj\n<< /Length ${enc.encode(conteudo).length} >>\nstream\n`)
  push(conteudo)
  push('\nendstream\nendobj\n')

  const xrefOff = len
  const total = 7
  let xref = `xref\n0 ${total}\n0000000000 65535 f\r\n`
  for (let i = 1; i < total; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n\r\n`
  push(xref)
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`)

  const out = new Uint8Array(len)
  let p = 0
  for (const c of partes) { out.set(c, p); p += c.length }
  return out
}
