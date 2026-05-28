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
  win: { label: 'Auction Won', color: 'var(--gold2)', icon: '🏆', hideAmount: true },
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
  const [selectedMembers, setSelectedMembers] = useState([])
  const [selectedType, setSelectedType] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

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
  if (isAdmin && selectedMembers.length > 0 && !selectedMembers.includes(l.member_id)) return false
  return true
})

const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name))
const searchedMembers = sortedMembers.filter(m =>
  m.name.toLowerCase().includes(memberSearch.toLowerCase()) &&
  !selectedMembers.includes(m.id)
)

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
<div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
  {isAdmin && (
    <div style={{ position: 'relative' }}>
      {/* Selected member tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: selectedMembers.length > 0 ? 8 : 0 }}>
        {selectedMembers.map(id => {
          const m = members.find(x => x.id === id)
          return m ? (
            <span key={id} style={{
              background: 'rgba(201,162,39,.15)', border: '1px solid var(--gold-dim)',
              color: 'var(--gold2)', fontFamily: 'Cinzel,serif', fontSize: 11,
              padding: '3px 8px', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 6,
              letterSpacing: 1,
            }}>
              {m.name}
              <span style={{ cursor: 'pointer', color: 'var(--text-dim)' }}
                onClick={() => setSelectedMembers(prev => prev.filter(x => x !== id))}>✕</span>
            </span>
          ) : null
        })}
        {selectedMembers.length > 0 && (
          <span style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}
            onClick={() => setSelectedMembers([])}>Clear all</span>
        )}
      </div>

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          value={memberSearch}
          onChange={e => { setMemberSearch(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search members..."
          style={{ width: 220 }}
        />
        {/* Dropdown */}
        {showDropdown && searchedMembers.length > 0 && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowDropdown(false)} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, width: 220,
              background: 'var(--surface)', border: '1px solid var(--gold-dim)',
              borderRadius: 2, zIndex: 20, maxHeight: 200, overflowY: 'auto',
              boxShadow: '0 4px 16px rgba(0,0,0,.5)', marginTop: 2,
            }}>
              {searchedMembers.map(m => (
                <div key={m.id}
                  onClick={() => {
                    setSelectedMembers(prev => [...prev, m.id])
                    setMemberSearch('')
                    setShowDropdown(false)
                  }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {m.name}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
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
                          {cfg.hideAmount
                            ? <span style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: 'var(--gold-dim)', letterSpacing: 1 }}>ITEM AWARDED</span>
                            : <span style={{
                                fontFamily: 'Cinzel,serif',
                                fontSize: 15,
                                color: isPositive ? 'var(--green-light)' : 'var(--red-light)',
                                fontWeight: 600,
                              }}>
                                {isPositive ? '+' : ''}{log.amount.toLocaleString()}
                              </span>
                          }
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
