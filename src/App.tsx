import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import AppShell from './components/AppShell'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="splash"><div className="spinner" /></div>
  }
  return session ? <AppShell /> : <Login />
}
