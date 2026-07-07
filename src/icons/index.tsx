// Ícones em SVG, sem biblioteca externa (menos dependências, mais leve).
// Todos herdam a cor do texto (currentColor) e o tamanho por prop.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round', strokeLinejoin: 'round',
})

export const IconDashboard = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
)
export const IconFlask = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9 3h6"/><path d="M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/></svg>
)
export const IconChart = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M13 16V8"/><path d="M18 16v-7"/></svg>
)
export const IconBox = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="M3 7.5 12 12l9-4.5"/><path d="M12 12v9"/></svg>
)
export const IconHarvest = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 13h16l-1.2 6.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 13Z"/><path d="M12 13c0-4 2-7 5-8"/><path d="M12 13c0-3-1.5-5.5-4-7"/></svg>
)
export const IconSettings = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.6l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>
)
export const IconMushroom = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 11a8 8 0 0 1 16 0 1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/><path d="M10 12v6a2 2 0 0 0 4 0v-6"/></svg>
)
export const IconSun = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
)
export const IconMoon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
)
export const IconLogout = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
)
