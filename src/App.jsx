import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { useAuth } from './context/AuthContext'
import Roster from './pages/Roster'
import Events from './pages/Events'
import Auction from './pages/Auction'
import Admin from './pages/Admin'
import Login from './pages/Login'
import MyBids from './pages/MyBids'
import PointsLog from './pages/PointsLog'
import AccessDenied from './pages/AccessDenied'
import NotificationBell from './components/NotificationBell'

export default function App() {
  const { toast, loading: dataLoading } = useApp()
  const { session, userRole, userInfo, loading: authLoading, roleLoading, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const page = location.pathname.replace('/', '') || 'roster'

  // Auth loading
  if (authLoading || roleLoading) {
    return (
      <div className="loading-screen">
        <span style={{ fontSize: 40 }}>⚔</span>
        <h2>Fidelis</h2>
        <p>{roleLoading ? 'Verifying Discord membership…' : 'Connecting…'}</p>
      </div>
    )
  }

  // Not logged in
  if (!session) return <Login />

  // Logged in but not a member
  if (userRole === 'denied') return <AccessDenied />

  // Data loading
  if (dataLoading) {
    return (
      <div className="loading-screen">
        <span style={{ fontSize: 40 }}>⚔</span>
        <h1>Fidelis</h1>
        <p>Loading guild data…</p>
      </div>
    )
  }

  const navItems = [
    { id: 'roster', label: 'Roster' },
    { id: 'events', label: 'Events' },
    { id: 'auction', label: 'Auction' },
    { id: 'mybids', label: 'My Bids' },
    { id: 'pointslog', label: 'Points Log' },
    ...(isAdmin ? [{ id: 'admin', label: '⚙ Admin' }] : []),
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span style={{ fontSize: 22 }}>⚔</span>
          <div>
            <h1>Fidelis</h1>
            <span>Guild Tracker by TitanJoy</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(p => (
            <button
              key={p.id}
              className={`nav-btn ${page === p.id ? 'active' : ''}`}
              onClick={() => navigate('/' + p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {userInfo?.avatar && (
            <img
              src={userInfo.avatar}
              alt="avatar"
              style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--gold-dim)' }}
            />
          )}
          <span className="role-badge">
            {isAdmin ? '⚔ Admiral' : '🛡 Fidelis'}
          </span>
          <NotificationBell />
          <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">↩</button>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/roster" replace />} />
          <Route path="/roster" element={<Roster />} />
          <Route path="/events" element={<Events />} />
          <Route path="/auction" element={<Auction />} />
          <Route path="/mybids" element={<MyBids />} />
          <Route path="/pointslog" element={<PointsLog />} />
          {isAdmin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/roster" replace />} />
        </Routes>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
