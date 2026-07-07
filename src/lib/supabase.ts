import { createClient } from '@supabase/supabase-js'

// As credenciais vêm das variáveis de ambiente (arquivo .env local, ou
// "secrets" no GitHub). A chave "anon" é pública por natureza — quem protege
// os dados é o Row Level Security configurado no Supabase.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Sinaliza para a interface quando as credenciais ainda não foram preenchidas,
// em vez de quebrar com um erro difícil de entender.
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key'
)
