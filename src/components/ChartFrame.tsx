import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconExpand, IconClose } from '../icons'

// Envolve um gráfico e oferece um botão para abrir em tela cheia.
// No celular tenta travar em paisagem; se o navegador não permitir, gira o
// conteúdo por CSS. No PC apenas ocupa a tela inteira.
export default function ChartFrame({ titulo, children }: { titulo?: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const [girar, setGirar] = useState(false)
  const overlay = useRef<HTMLDivElement>(null)

  const abrir = async () => {
    setAberto(true)
    const el = overlay.current
    try { if (el?.requestFullscreen) await el.requestFullscreen() } catch { /* sem tela cheia: segue no overlay */ }
    // Trava em paisagem quando o navegador permite (Android/Chrome em tela cheia).
    const orient = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined
    let travou = false
    try {
      if (orient?.lock) { await orient.lock('landscape'); travou = true }
    } catch { travou = false }
    const estreito = window.innerWidth < 860
    setGirar(!travou && estreito && window.innerHeight > window.innerWidth)
  }

  const fechar = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignora */ }
    const orient = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined
    try { orient?.unlock?.() } catch { /* ignora */ }
    setGirar(false)
    setAberto(false)
  }

  // Fechar com ESC e manter o estado em sincronia se o usuário sair da tela cheia.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    const onFs = () => { if (!document.fullscreenElement) { setGirar(false); setAberto(false) } }
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
    }
  }, [aberto])

  return (
    <div className="chart-frame">
      <button className="chart-expand" onClick={abrir} aria-label="Abrir em tela cheia" title="Tela cheia">
        <IconExpand size={16} />
      </button>
      {children}

      {aberto && (
        <div className="chart-overlay" ref={overlay}>
          <div className={`chart-overlay-inner ${girar ? 'girado' : ''}`}>
            {titulo && <div className="chart-overlay-title">{titulo}</div>}
            <div className="chart-overlay-body">{children}</div>
            <div className="rodape-marca">Powered by AgriCore</div>
          </div>
          <button className="chart-close" onClick={fechar} aria-label="Fechar">
            <IconClose size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
