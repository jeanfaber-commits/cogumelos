import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured } from '../lib/supabase'
import { IconMushroom } from '../icons'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const entrar = async () => {
    setErro(null)
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return }
    setCarregando(true)
    const { error } = await signIn(email.trim(), senha)
    setCarregando(false)
    if (error) setErro(error)
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="auth-head">
          <div className="auth-mark"><IconMushroom size={28} /></div>
          <div className="auth-title">Controle de Produção</div>
          <div className="auth-sub">Entre para acessar o painel</div>
        </div>

        {!supabaseConfigured && (
          <div className="auth-error">
            Conexão com o banco ainda não configurada. Preencha o arquivo <b>.env</b> com
            os dados do Supabase (veja o README).
          </div>
        )}

        {erro && <div className="auth-error">{erro}</div>}

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()} placeholder="voce@exemplo.com" />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input id="senha" className="input" type="password" autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && entrar()} placeholder="••••••••" />
        </div>

        <button className="btn btn-primary btn-full" onClick={entrar} disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
