import { createContext, useContext } from 'react'
import type { Rota } from '../components/Nav'

type NavCtx = { rota: Rota; irPara: (r: Rota) => void }

const Ctx = createContext<NavCtx>({ rota: 'painel', irPara: () => {} })
export const useNav = () => useContext(Ctx)
export const NavProvider = Ctx.Provider
