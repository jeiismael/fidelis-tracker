import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TYPE_CONFIG = {
  bid:        { label: 'Bid Placed',       color: 'var(--red-light)',   icon: '🏷' },
  refund:     { label: 'Outbid Refund',    color: 'var(--green-light)', icon: '↩' },
  attendance: { label: 'Event Attendance', color: 'var(--gold2)',       icon: '⚔' },
  manual_add: { label: 'Manual Add',       color: 'var(--green-light)', icon: '+' },
  manual_sub: { label: 'Manual Deduct',    color: 'var(--red-light)',   icon: '-' },
  manual_set: { label: 'Points Set',       color: 'var(--amber)',       icon: '✎' },
  win:        { label: 'Auction Won',      color: 'var(--gold2)',       icon: '🏆' },
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

export default function PointsLog() {
  const { members } = useApp()
  const { isAdmin, discordNickname } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState('all')
  const [selectedType, setSelectedType] = useState('all')

  const myMember = discordNickname
    ? members.find(m => m.name.toLowerCase() === discordNickname.toLowerCase())
    : null

  useEffect(() => {
    fetchLogs()
  }, [myMember, isAdmin])

  async function fetchLogs() {
    setLoading(true)
    let query = supabase
      .from('points_log')
      .select('*, members(name)')
      .order('created_at', { ascending: false })
      .limit(200)

    // Non-admins only see their own logs
    if (!isAdmin && myMember) {
      query = query.eq('member_id', myMember.id)
    }

    const { data } = await query
    if (data) setLogs(data)
    setLoading(false)
  }

  // Filter logs
  const filtered = logs.filter(l => {
    if (selectedType !== 'all' && l.type !== selectedType) return false
    if (isAdmin && selectedMember !== 'all' && l.member_id !== selectedMember) return false
    return true
  })

  if (!isAdmin && !myMember) {
    return <div className="empty-state" style={{ marginTop: 40 }}>Your character hasn't been enlisted yet. Contact your Admiral.</div>
  }

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚔ Points Log</div>
        {myMember && (
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: 'var(--gold)' }}>
            {isAdmin ? '' : `${myMember.name} · ${myMember.points.toLocaleString()} pts`}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {isAdmin && (
          <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)} style={{ width: 180 }}>
            <option value="all">All Members</option>
            {[...members].sort((a,b) => a.name.localeCompare(b.name)).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={{ width: 180 }}>
          <option value="all">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {loading
        ? <div className="empty-state">Loading…</div>
        : filtered.length === 0
          ? <div className="empty-state">No points history yet.</div>
          : (
            <div className="panel" style={{ padding: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    {isAdmin && <th>Member</th>}
                    <th>Type</th>
                    <th>Reason</th>
                    <th>Amount</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(log => {
                    const cfg = TYPE_CONFIG[log.type] || { label: log.type, color: 'var(--text-dim)', icon: '·' }
                    const isPositive = log.amount > 0
                    return (
                      <tr key={log.id}>
                        {isAdmin && (
                          <td style={{ fontWeight: 600 }}>{log.members?.name || '—'}</td>
                        )}
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span>{cfg.icon}</span>
                            <span style={{ color: cfg.color, fontFamily: 'Cinzel,serif', fontSize: 11, letterSpacing: 1 }}>{cfg.label}</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{log.reason || '—'}</td>
                        <td>
                          <span style={{
                            fontFamily: 'Cinzel,serif',
                            fontSize: 15,
                            color: isPositive ? 'var(--green-light)' : 'var(--red-light)',
                            fontWeight: 600,
                          }}>
                            {isPositive ? '+' : ''}{log.amount.toLocaleString()}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-faint)', fontSize: 12 }}>{timeAgo(log.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
      }
    </>
  )
}
