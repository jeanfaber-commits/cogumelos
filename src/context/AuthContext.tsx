import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthCtx = {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null, user: null, loading: true,
  signIn: async () => ({ error: null }), signOut: async () => {},
})
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? traduzErro(error.message) : null }
  }
  const signOut = async () => { await supabase.auth.signOut() }

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

// Mensagens de erro mais claras para o operador (em português).
function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.'
  if (/network/i.test(msg)) return 'Sem conexão. Verifique a internet.'
  return msg
}
