import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import Modal from '../components/Modal'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const { members, events, items, bids, attendance, addMember, updateMember, removeMember, removeEvent, endAuction, removeItem, resetSeason, showToast } = useApp()
  const [tab, setTab] = useState('members')
  const [modal, setModal] = useState(null)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [registry, setRegistry] = useState([])
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registrySearch, setRegistrySearch] = useState('')
  const [thumbnailFile, setThumbnailFile] = useState(null)
  const [thumbnailPreview, setThumbnailPreview] = useState(null)
  const fileInputRef = useRef(null)

  async function loadRegistry() {
    setRegistryLoading(true)
    const { data } = await supabase.from('item_registry').select('*').order('name')
    if (data) setRegistry(data)
    setRegistryLoading(false)
  }

  function rankBadge(rank) {
    return rank === 'Officer' ? 'badge-gold' : rank === 'Recruit' ? 'badge-dim' : 'badge-green'
  }

  function openEdit(m) { setSelected(m); setForm({ name: m.name, rank: m.rank }); setModal('edit') }

  function openAddRegistryItem() {
    setForm({ name: '', description: '' })
    setThumbnailFile(null)
    setThumbnailPreview(null)
    setModal('add-registry')
  }

  function openEditRegistryItem(item) {
    setSelected(item)
    setForm({ name: item.name, description: item.description || '' })
    setThumbnailFile(null)
    setThumbnailPreview(item.thumbnail_url || null)
    setModal('edit-registry')
  }

  function handleThumbnailChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setThumbnailFile(file)
    setThumbnailPreview(URL.createObjectURL(file))
  }

  async function uploadThumbnail(file, itemName) {
    const ext = file.name.split('.').pop()
    const path = `${itemName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('item-images').upload(path, file, { upsert: true })
    if (error) { showToast('Image upload failed: ' + error.message); return null }
    const { data } = supabase.storage.from('item-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleAddRegistryItem() {
    if (!form.name?.trim()) return
    setBusy(true)
    let thumbnail_url = null
    if (thumbnailFile) {
      thumbnail_url = await uploadThumbnail(thumbnailFile, form.name.trim())
    }
    const { error } = await supabase.from('item_registry').insert({
      name: form.name.trim(),
      description: form.description?.trim() || null,
      thumbnail_url,
    })
    if (error) { showToast('Error: ' + error.message); setBusy(false); return }
    showToast(`"${form.name}" added to registry`)
    await loadRegistry()
    setBusy(false); setModal(null)
  }

  async function handleEditRegistryItem() {
    if (!form.name?.trim() || !selected) return
    setBusy(true)
    let thumbnail_url = selected.thumbnail_url
    if (thumbnailFile) {
      thumbnail_url = await uploadThumbnail(thumbnailFile, form.name.trim())
    }
    const { error } = await supabase.from('item_registry').update({
      name: form.name.trim(),
      description: form.description?.trim() || null,
      thumbnail_url,
    }).eq('id', selected.id)
    if (error) { showToast('Error: ' + error.message); setBusy(false); return }
    showToast(`"${form.name}" updated`)
    await loadRegistry()
    setBusy(false); setModal(null)
  }

  async function handleDeleteRegistryItem(id, name) {
    if (!confirm(`Remove "${name}" from the registry?`)) return
    const { error } = await supabase.from('item_registry').delete().eq('id', id)
    if (error) { showToast('Error: ' + error.message); return }
    showToast(`"${name}" removed from registry`)
    await loadRegistry()
  }

  async function handleAdd() {
    if (!form.name?.trim()) return
    setBusy(true)
    await addMember({ name: form.name.trim(), rank: form.rank || 'Recruit', points: Number(form.points) || 0 })
    setBusy(false); setModal(null)
  }

  async function handleEdit() {
    setBusy(true)
    await updateMember(selected.id, { name: form.name?.trim() || selected.name, rank: form.rank })
    setBusy(false); setModal(null)
  }

  async function handleResetSeason() {
    if (!confirm('Reset ALL members\' points to 0 and wipe all attendance history? This cannot be undone.')) return
    setBusy(true)
    await resetSeason()
    setBusy(false)
  }

  const filteredRegistry = registry.filter(i =>
    i.name.toLowerCase().includes(registrySearch.toLowerCase()) ||
    (i.description || '').toLowerCase().includes(registrySearch.toLowerCase())
  )

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚔ Administration</div>
      </div>

      <div className="tab-bar">
        {['members', 'events', 'items', 'registry'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); if (t === 'registry') loadRegistry() }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── MEMBERS ── */}
      {tab === 'members' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-red btn-sm" onClick={handleResetSeason} disabled={busy}>
              {busy ? 'Resetting…' : '⟲ Reset Points & Attendance'}
            </button>
            <button className="btn btn-gold btn-sm" onClick={() => { setForm({ name: '', rank: 'Recruit', points: 0 }); setModal('add') }}>+ Enlist Member</button>
          </div>
          <div className="panel">
            {members.length === 0 ? <div className="empty-state">No members yet.</div> : (
              <table className="tbl">
                <thead><tr><th>Name</th><th>Rank</th><th>Points</th><th>Attended</th><th></th></tr></thead>
                <tbody>
                  {[...members].sort((a, b) => b.points - a.points).map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td><span className={`badge ${rankBadge(m.rank)}`}>{m.rank}</span></td>
                      <td style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)' }}>{m.points.toLocaleString()}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{attendance.filter(a => a.member_id === m.id).length}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)}>Edit</button>
                        <button className="btn btn-red btn-sm" style={{ marginLeft: 4 }} onClick={() => removeMember(m.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── EVENTS ── */}
      {tab === 'events' && (
        <div className="panel">
          {events.length === 0 ? <div className="empty-state">No events yet.</div> : (
            <table className="tbl">
              <thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Points</th><th>Attended</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {[...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(ev => (
                  <tr key={ev.id}>
                    <td style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold2)' }}>{ev.name}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{ev.type}</td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{new Date(ev.date).toLocaleDateString()}</td>
                    <td style={{ color: 'var(--gold)' }}>{ev.points_reward}</td>
                    <td>{attendance.filter(a => a.event_id === ev.id).length}</td>
                    <td><span className={`badge ${ev.locked ? 'badge-dim' : 'badge-green'}`}>{ev.locked ? 'Closed' : 'Open'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-red btn-sm" onClick={() => removeEvent(ev.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── ITEMS ── */}
      {tab === 'items' && (
        <div className="panel">
          {items.length === 0 ? <div className="empty-state">No auction items yet.</div> : (
            <table className="tbl">
              <thead><tr><th>Item</th><th>Status</th><th>End Time</th><th>Bids</th><th>Top Bid</th><th></th></tr></thead>
              <tbody>
                {[...items].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(item => {
                  const itemBids = bids.filter(b => b.item_id === item.id)
                  const topBid = itemBids.length ? Math.max(...itemBids.map(b => b.amount)) : null
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.thumbnail_url && (
                            <img src={item.thumbnail_url} alt={item.name}
                              style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--border2)' }} />
                          )}
                          <span style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold2)' }}>{item.name}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${item.status === 'active' ? 'badge-green' : 'badge-dim'}`}>{item.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.end_time ? new Date(item.end_time).toLocaleString() : '—'}</td>
                      <td style={{ color: 'var(--text-dim)' }}>{itemBids.length}</td>
                      <td style={{ color: 'var(--gold)' }}>{topBid ? topBid.toLocaleString() + ' pts' : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        {item.status === 'active' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => endAuction(item.id)}>End</button>
                        )}
                        <button className="btn btn-red btn-sm" style={{ marginLeft: 4 }} onClick={() => removeItem(item.id)}>Remove</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── REGISTRY ── */}
      {tab === 'registry' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <input
              value={registrySearch}
              onChange={e => setRegistrySearch(e.target.value)}
              placeholder="Search items..."
              style={{ width: 260 }}
            />
            <button className="btn btn-gold btn-sm" onClick={openAddRegistryItem}>+ Add Item</button>
          </div>

          {registryLoading
            ? <div className="empty-state">Loading registry…</div>
            : filteredRegistry.length === 0
              ? <div className="empty-state">{registrySearch ? 'No items match your search.' : 'No items in registry yet.'}</div>
              : (
                <div className="grid-3">
                  {filteredRegistry.map(item => (
                    <div key={item.id} className="panel" style={{ padding: 12 }}>
                      {item.thumbnail_url
                        ? <img src={item.thumbnail_url} alt={item.name}
                            style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 2, marginBottom: 10, border: '1px solid var(--border2)' }} />
                        : <div style={{ width: '100%', height: 140, background: 'var(--surface2)', borderRadius: 2, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 28 }}>⚔</div>
                      }
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: 14, color: 'var(--gold2)', marginBottom: 4 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{item.description}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditRegistryItem(item)}>Edit</button>
                        <button className="btn btn-red btn-sm" onClick={() => handleDeleteRegistryItem(item.id, item.name)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </>
      )}

      {/* ── MODALS ── */}
      {modal === 'add' && (
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

      {modal === 'edit' && selected && (
        <Modal title={`Edit — ${selected.name}`} onClose={() => setModal(null)}>
          <div className="form-group">
            <label>Character Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Rank</label>
            <select value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))}>
              <option>Recruit</option><option>Member</option><option>Officer</option>
            </select>
          </div>
          <button className="btn btn-gold btn-full" onClick={handleEdit} disabled={busy}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </Modal>
      )}

      {(modal === 'add-registry' || modal === 'edit-registry') && (
        <Modal title={modal === 'add-registry' ? 'Add Item to Registry' : `Edit — ${selected?.name}`} onClose={() => setModal(null)}>
          {/* Thumbnail upload */}
          <div className="form-group">
            <label>Thumbnail</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', height: 160, background: 'var(--surface2)', border: '1px dashed var(--border2)',
                borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden', position: 'relative',
              }}
            >
              {thumbnailPreview
                ? <img src={thumbnailPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: 'var(--text-faint)' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: 12, fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>Click to upload image</div>
                  </div>
              }
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumbnailChange} />
            {thumbnailPreview && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }}
                onClick={() => { setThumbnailFile(null); setThumbnailPreview(null) }}>
                Remove image
              </button>
            )}
          </div>

          <div className="form-group">
            <label>Item Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dragon Scale Armor" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional short description" />
          </div>
          <button className="btn btn-gold btn-full"
            onClick={modal === 'add-registry' ? handleAddRegistryItem : handleEditRegistryItem}
            disabled={busy || !form.name?.trim()}>
            {busy ? 'Saving…' : modal === 'add-registry' ? 'Add to Registry' : 'Save Changes'}
          </button>
        </Modal>
      )}
    </>
  )
}
