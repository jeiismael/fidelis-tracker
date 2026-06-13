import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'

function CodeTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    function calc() {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}m ${s}s`)
      setUrgent(diff < 5 * 60 * 1000)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return (
    <span style={{ color: urgent ? 'var(--red-light)' : 'var(--amber)', fontFamily: 'Cinzel,serif', fontSize: 12 }}>
      ⏳ {timeLeft} remaining
    </span>
  )
}

export default function Events() {
  const { events, members, attendance, createEvent, removeEvent, toggleAttendance, markAllAttendance, clearAllAttendance, lockEvent, generateCheckinCode, checkinWithCode, closeCheckin } = useApp()
  const { isAdmin, discordNickname } = useAuth()
  const [modal, setModal] = useState(null)
  const [selectedEvId, setSelectedEvId] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [checkinInput, setCheckinInput] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const [checkinSuccess, setCheckinSuccess] = useState('')
  const [generatedCode, setGeneratedCode] = useState(null)
  const [copied, setCopied] = useState(false)

  const sorted = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  // Find the logged-in member record
  const myMember = discordNickname
    ? members.find(m => m.name.toLowerCase() === discordNickname.toLowerCase())
    : null

  function openCreate() {
    setForm({ name: '', type: 'World Boss', date: new Date().toISOString().split('T')[0], points_reward: 50 })
    setModal('create')
  }

  function openAttendance(evId) { setSelectedEvId(evId); setModal('attendance') }

  function openCheckin() {
    setCheckinInput('')
    setCheckinError('')
    setCheckinSuccess('')
    setModal('checkin')
  }

  async function openGenerateCode(evId) {
  setSelectedEvId(evId)
  setGeneratedCode(null)
  setCopied(false)
  setModal('generate-code')

  // Check if there's an active code for this event
  const ev = events.find(e => e.id === evId)
  if (ev?.checkin_code && ev?.checkin_expires_at && new Date(ev.checkin_expires_at) > new Date()) {
    // Code still active — show it without generating a new one
    setGeneratedCode(ev.checkin_code)
    return
  }

  // No active code — generate a new one
  setBusy(true)
  const code = await generateCheckinCode(evId)
  setGeneratedCode(code)
  setBusy(false)
}

  async function handleCreate() {
    if (!form.name?.trim()) return
    setBusy(true)
    await createEvent({ name: form.name.trim(), type: form.type, date: form.date, points_reward: Number(form.points_reward) || 50 })
    setBusy(false); setModal(null)
  }

  async function handleLock(evId) {
    if (!confirm('Lock this event and award points to all marked attendees?')) return
    setBusy(true)
    await lockEvent(evId)
    setBusy(false); setModal(null)
  }

  async function handleCheckin() {
    setCheckinError('')
    setCheckinSuccess('')
    if (!checkinInput.trim()) { setCheckinError('Please enter a check-in code.'); return }
    if (!myMember) { setCheckinError('Your character is not enlisted in the roster yet. Contact your Admiral.'); return }
    setBusy(true)
    const result = await checkinWithCode(checkinInput, myMember.id)
    setBusy(false)
    if (!result.ok) { setCheckinError(result.msg); return }
    setCheckinSuccess(`✓ Successfully checked in to "${result.event.name}"! You will earn ${result.event.points_reward} pts when the event is locked.`)
    setCheckinInput('')
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedEvent = events.find(e => e.id === selectedEvId)
  const eventAttendees = attendance.filter(a => a.event_id === selectedEvId).map(a => a.member_id)

  // Check if member already checked in to an event
  function alreadyCheckedIn(evId) {
    if (!myMember) return false
    return attendance.some(a => a.event_id === evId && a.member_id === myMember.id)
  }

  // Check if event code is still active
  function codeIsActive(ev) {
    return ev.checkin_code && ev.checkin_expires_at && new Date(ev.checkin_expires_at) > new Date() && !ev.locked
  }

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚔ Event Attendance</div>
        <div style={{ display: 'flex', gap: 8 }}>
  {myMember && (
    <button className="btn btn-gold btn-sm" onClick={openCheckin}>⚑ Check In</button>
  )}
  {isAdmin && <button className="btn btn-gold btn-sm" onClick={openCreate}>+ Create Event</button>}
</div>
      </div>

      {/* Member without roster entry */}
      {!isAdmin && !myMember && discordNickname && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          Your character <b style={{ color: 'var(--gold)' }}>{discordNickname}</b> hasn't been enlisted yet. Contact your Admiral to be added to the roster.
        </div>
      )}

      {sorted.length === 0
        ? <div className="empty-state">{isAdmin ? 'Create your first event to begin tracking attendance.' : 'No events yet. Check back later.'}</div>
        : sorted.map(ev => {
          const att = attendance.filter(a => a.event_id === ev.id)
          const checkedIn = alreadyCheckedIn(ev.id)
          const active = codeIsActive(ev)
          return (
            <div key={ev.id} className="panel" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Cinzel,serif', fontSize: 20, color: 'var(--gold2)' }}>{ev.name}</div>
                  <div style={{ fontSize: 15, color: 'var(--text-dim)', marginTop: 2 }}>
                    {ev.type} · {new Date(ev.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · <b style={{ color: 'var(--gold)' }}>{ev.points_reward} pts</b> per attendee
                  </div>
                  {/* Show active code timer */}
                  {isAdmin && active && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'Cinzel,serif', fontSize: 15, color: 'var(--gold)', background: 'rgba(201,162,39,.1)', border: '1px solid var(--gold-dim)', padding: '2px 10px', borderRadius: 2, letterSpacing: 2 }}>
                        {ev.checkin_code}
                      </span>
                      <CodeTimer expiresAt={ev.checkin_expires_at} />
                      <button className="btn btn-ghost btn-sm" onClick={() => copyCode(ev.checkin_code)}>Copy</button>
                    </div>
                  )}
                  {/* Member check-in status */}
                  {!isAdmin && myMember && !ev.locked && (
                    <div style={{ marginTop: 6 }}>
                      {checkedIn
                        ? <span className="badge badge-green">✓ Checked In</span>
                        : <span className="badge badge-dim">Not checked in</span>
                      }
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className={`badge ${ev.locked ? 'badge-dim' : 'badge-green'}`}>{ev.locked ? 'Closed' : 'Open'}</span>
                  {isAdmin && !ev.locked && <>
                    <button className="btn btn-gold btn-sm" onClick={() => openGenerateCode(ev.id)}>⚑ Code</button>
                    {codeIsActive(ev) && (
    <button className="btn btn-ghost btn-sm" onClick={() => closeCheckin(ev.id)}>Close Check-in</button>
  )}
                    <button className="btn btn-ghost btn-sm" onClick={() => openAttendance(ev.id)}>Attendance</button>
                  </>}
                  {isAdmin && <button className="btn btn-red btn-sm" onClick={() => removeEvent(ev.id)}>Remove</button>}
                </div>
              </div>
              <div style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 10 }}>
  Attended: <b style={{ color: 'var(--text)' }}>{att.length}</b> / {members.length} members
</div>

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px 12px' }}>
  {[...members].sort((a, b) => a.name.localeCompare(b.name)).map(m => {
    const checked = att.some(a => a.member_id === m.id)
    return (
      <div key={m.id} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        color: checked ? 'var(--gold)' : 'var(--text-faint)',
      }}>
        <span>{checked ? '✓' : '○'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
      </div>
    )
  })}
</div>
            </div>
          )
        })}

      {/* ── CREATE EVENT MODAL ── */}
      {isAdmin && modal === 'create' && (
        <Modal title="Create Event" onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Event Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Castle Siege, World Boss" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
  <option>World Boss</option><option>Sindri's Island</option><option>Clan Battle</option>
  <option>Server Battle</option><option>Clan Sanctuary</option><option>Special Event</option>
</select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Points Rewarded per Attendee</label>
            <input type="number" value={form.points_reward} min={1} onChange={e => setForm(f => ({ ...f, points_reward: e.target.value }))} />
          </div>
          <button className="btn btn-gold btn-full" onClick={handleCreate} disabled={busy || !form.name?.trim()}>
            {busy ? 'Creating…' : 'Create Event'}
          </button>
        </Modal>
      )}

      {/* ── GENERATE CODE MODAL ── */}
      {isAdmin && modal === 'generate-code' && selectedEvent && (
        <Modal title={`Check-in Code — ${selectedEvent.name}`} onClose={() => setModal(null)}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {busy
              ? <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Generating code…</div>
              : generatedCode ? <>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1, fontFamily: 'Cinzel,serif', marginBottom: 8 }}>SHARE THIS CODE WITH YOUR MEMBERS</div>
                <div style={{
                  fontFamily: 'Cinzel,serif', fontSize: 32, color: 'var(--gold2)',
                  background: 'rgba(201,162,39,.08)', border: '1px solid var(--gold-dim)',
                  borderRadius: 2, padding: '12px 24px', letterSpacing: 4, marginBottom: 12
                }}>
                  {generatedCode}
                </div>
                {(() => {
  const ev = events.find(e => e.id === selectedEvId)
  const isExisting = ev?.checkin_expires_at && new Date(ev.checkin_expires_at) > new Date()
  return isExisting ? (
    <>
      <div style={{ marginBottom: 8 }}><CodeTimer expiresAt={ev.checkin_expires_at} /></div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic', marginBottom: 16 }}>
        A new code can only be generated after this one expires.
      </div>
    </>
  ) : (
    <div style={{ fontSize: 13, color: 'var(--amber)', fontFamily: 'Cinzel,serif', marginBottom: 16 }}>
      Expires in 1 hour
    </div>
  )
})()}
                <button className="btn btn-gold" onClick={() => copyCode(generatedCode)}>
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
              </>
              : <div style={{ color: 'var(--text-dim)' }}>Failed to generate code.</div>
            }
          </div>
          <hr className="divider" />
          <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center' }}>
            Members enter this code in the Events page to mark themselves present. Code expires automatically after 1 hour.
          </div>
        </Modal>
      )}

      {/* ── MEMBER CHECK-IN MODAL ── */}
      {modal === 'checkin' && (
        <Modal title="Event Check-In" onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
            Enter the check-in code shared by your Admiral to mark your attendance.
          </div>
          <div className="form-group">
            <label>Check-in Code</label>
            <input
              value={checkinInput}
              onChange={e => setCheckinInput(e.target.value.toUpperCase())}
              placeholder="e.g. SIEGE-4821"
              style={{ fontFamily: 'Cinzel,serif', letterSpacing: 2, fontSize: 18, textAlign: 'center' }}
              onKeyDown={e => e.key === 'Enter' && handleCheckin()}
            />
          </div>
          {checkinError && <div className="error-banner" style={{ marginBottom: 12 }}>{checkinError}</div>}
          {checkinSuccess && (
            <div style={{ background: 'rgba(46,125,80,.15)', border: '1px solid var(--green)', color: 'var(--green-light)', padding: '10px 14px', borderRadius: 2, fontSize: 13, marginBottom: 12 }}>
              {checkinSuccess}
            </div>
          )}
          <button className="btn btn-gold btn-full" onClick={handleCheckin} disabled={busy || !checkinInput.trim()}>
            {busy ? 'Checking in…' : 'Check In'}
          </button>
        </Modal>
      )}

      {/* ── MANUAL ATTENDANCE MODAL (admin) ── */}
      {isAdmin && modal === 'attendance' && selectedEvent && (
        <Modal title={`Attendance — ${selectedEvent.name}`} onClose={() => setModal(null)}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>
            Manually mark attendance. Each member earns <b style={{ color: 'var(--gold)' }}>{selectedEvent.points_reward} pts</b> when locked.
          </div>
          {members.map(m => (
            <div key={m.id} className="member-row">
              <div style={{ fontSize: 14 }}>{m.name}</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: 'var(--gold)' }}>{m.points.toLocaleString()} pts</div>
              <button
                className={`check-btn ${eventAttendees.includes(m.id) ? 'checked' : ''}`}
                onClick={() => toggleAttendance(selectedEvId, m.id)}
              >
                {eventAttendees.includes(m.id) ? '✓' : '○'}
              </button>
            </div>
          ))}
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button className="btn btn-green btn-sm" onClick={() => markAllAttendance(selectedEvId)}>Mark All</button>
            <button className="btn btn-ghost btn-sm" onClick={() => clearAllAttendance(selectedEvId)}>Clear All</button>
            <button className="btn btn-gold btn-sm" style={{ marginLeft: 'auto' }} onClick={() => handleLock(selectedEvId)} disabled={busy}>
              {busy ? 'Locking…' : 'Lock & Award Points'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
