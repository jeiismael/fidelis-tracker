import { useAuth } from '../context/AuthContext'

export default function AccessDenied() {
  const { userInfo, logout } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <h1 style={{
        fontFamily: 'Cinzel,serif',
        fontSize: 22,
        color: 'var(--red-light)',
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        Access Denied
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 }}>
        {userInfo?.username ? `${userInfo.username}, you` : 'You'} do not have the <span style={{ color: 'var(--gold)' }}>Fidelis</span> role in the Iron Veil Discord server.
      </p>
      <p style={{ color: 'var(--text-faint)', fontSize: 13, marginBottom: 32, fontStyle: 'italic', maxWidth: 400, textAlign: 'center' }}>
        If you believe this is an error, please contact your guild officers in Discord to have your membership verified.
      </p>
      <button className="btn btn-ghost" onClick={logout}>← Sign out</button>
    </div>
  )
}
