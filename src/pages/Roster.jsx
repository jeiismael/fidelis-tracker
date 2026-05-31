import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Roster() {
  const { members, events, items, attendance, addMember, removeMember, adjustPoints } = useApp()
  const { isAdmin } = useAuth()
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const sorted = [...members]
  .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  .sort((a, b) => b.points - a.points)
  const totalPts = members.reduce((s, m) => s + m.points, 0)

  const [attendanceCounts, setAttendanceCounts] = useState({})

useEffect(() => {
  supabase
    .from('points_log')
    .select('member_id')
    .eq('type', 'attendance')
    .then(({ data }) => {
      if (!data) return
      const counts = {}
      data.forEach(log => {
        counts[log.member_id] = (counts[log.member_id] || 0) + 1
      })
      setAttendanceCounts(counts)
    })
}, [])

  function openAdd() { setForm({ name: '', rank: 'Recruit', points: 0 }); setModal('add') }
  function openAdjust(m) { setSelected(m); setForm({ type: 'add', amount: 0 }); setModal('adjust') }

  async function handleAdd() {
    if (!form.name?.trim()) return
    setBusy(true)
    await addMember({ name: form.name.trim(), rank: form.rank, points: Number(form.points) || 0 })
    setBusy(false); setModal(null)
  }

  async function handleAdjust() {
    if (!selected) return
    setBusy(true)
    await adjustPoints(selected.id, form.type, Number(form.amount) || 0)
    setBusy(false); setModal(null)
  }

  async function handleRemove(id, name) {
    if (!confirm(`Remove ${name} from the guild?`)) return
    await removeMember(id)
  }

  function rankBadge(rank) {
    return rank === 'Officer' ? 'badge-gold' : rank === 'Recruit' ? 'badge-dim' : 'badge-green'
  }

  return (
    <>
      <div className="grid-2" style={{ marginBottom: 20, maxWidth: 400 }}>
  <div className="stat-card">
    <div className="stat-val">{members.length}</div>
    <div className="stat-label">Members</div>
  </div>
  <div className="stat-card">
    <div className="stat-val">{items.filter(i => i.status === 'active').length}</div>
    <div className="stat-label">Active Auctions</div>
  </div>
</div>

      <div className="rune-line">ᚱ ᚢ ᚾ ᛖ ᛋ ᛟ ᚠ ᚢ ᛏ ᚺ ᚨ ᚱ ᚲ</div>
      <div className="section-header">
  <div className="section-title">⚔ Member Roster</div>
  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
    <input
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="Search members..."
      style={{ width: 200, fontSize: 14 }}
    />
    {isAdmin && <button className="btn btn-gold btn-sm" onClick={openAdd}>+ Enlist Member</button>}
  </div>
</div>

      <div className="panel" style={{ marginTop: 12 }}>
        {sorted.length === 0
          ? <div className="empty-state">No members yet. Enlist your first guild member.</div>
          : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Rank</th><th>Points</th><th>Events Attended</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => {
                  const attended = attendanceCounts[m.id] || 0
                  return (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-faint)', fontFamily: 'Cinzel,serif', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><span className={`badge ${rankBadge(m.rank)}`}>{m.rank}</span></td>
                      <td>
                        <span style={{ fontFamily: 'Cinzel,serif', fontSize: 15, color: 'var(--gold2)' }}>
                          {m.points.toLocaleString()}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>{attended}</td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openAdjust(m)}>Adjust</button>
                          <button className="btn btn-red btn-sm" style={{ marginLeft: 4 }} onClick={() => handleRemove(m.id, m.name)}>Remove</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
      </div>

      {isAdmin && modal === 'add' && (
        <Modal title="Enlist Member" onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Character Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter character name" />
          </div>
          <div className="form-group">
            <label>Rank</label>
            <select value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
              <option>Recruit</option><option>Member</option><option>Officer</option>
            </select>
          </div>
          <div className="form-group">
            <label>Starting Points</label>
            <input type="number" value={form.points} min={0} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
          </div>
          <button className="btn btn-gold btn-full" onClick={handleAdd} disabled={busy || !form.name?.trim()}>
            {busy ? 'Enlisting…' : 'Enlist to Guild'}
          </button>
        </Modal>
      )}

      {isAdmin && modal === 'adjust' && selected && (
        <Modal title={`Adjust Points — ${selected.name}`} onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1, fontFamily: 'Cinzel,serif' }}>CURRENT BALANCE</div>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 32, color: 'var(--gold2)' }}>{selected.points.toLocaleString()} pts</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="add">Add Points</option>
                <option value="sub">Deduct Points</option>
                <option value="set">Set to</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input type="number" value={form.amount} min={0} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-gold btn-full" onClick={handleAdjust} disabled={busy}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </Modal>
      )}
    </>
  )
}
