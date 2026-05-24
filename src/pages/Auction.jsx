import { useState, useCallback, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/Modal'
import AuctionTimer from '../components/AuctionTimer'
import { supabase } from '../lib/supabase'

export default function Auction() {
  const { items, bids, members, placeBid, endAuction, addItem, showToast } = useApp()
  const { isAdmin, discordNickname } = useAuth()
  const [modal, setModal] = useState(null)
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [bidError, setBidError] = useState('')
  const [registry, setRegistry] = useState([])
  const [registrySearch, setRegistrySearch] = useState('')
  const [selectedRegistryItem, setSelectedRegistryItem] = useState(null)

  useEffect(() => {
    if (modal === 'add') loadRegistry()
  }, [modal])

  async function loadRegistry() {
    const { data } = await supabase.from('item_registry').select('*').order('name')
    if (data) setRegistry(data)
  }

  // Find the logged-in user's member record by matching Discord nickname
  const myMember = discordNickname
    ? members.find(m => m.name.toLowerCase() === discordNickname.toLowerCase())
    : null

  const filteredRegistry = registry.filter(i =>
    i.name.toLowerCase().includes(registrySearch.toLowerCase()) ||
    (i.description || '').toLowerCase().includes(registrySearch.toLowerCase())
  )

  function openAdd() {
    setForm({ min_bid: 10, duration_ms: '86400000', quantity: 1 })
    setSelectedRegistryItem(null)
    setRegistrySearch('')
    setModal('add')
  }

  function openBid(id) {
  setSelectedItemId(id)
  setBidError('')
  const defaultMember = myMember?.id || members[0]?.id || ''
  setForm({ memberId: defaultMember, amount: '' })
  setModal('bid')
}

  function selectRegistryItem(item) { setSelectedRegistryItem(item) }

  async function handleAdd() {
  if (!selectedRegistryItem) return
  setBusy(true)
  const quantity = Math.max(1, Number(form.quantity) || 1)
  const promises = Array.from({ length: quantity }, () =>
    addItem({
      name: selectedRegistryItem.name,
      description: selectedRegistryItem.description || '',
      thumbnail_url: selectedRegistryItem.thumbnail_url || null,
      min_bid: Number(form.min_bid) || 10,
      duration_ms: Number(form.duration_ms) || 0,
    })
  )
  await Promise.all(promises)
  setBusy(false)
  showToast(`${quantity} x "${selectedRegistryItem.name}" listed for auction`)
  setModal(null)
}

  async function handleBid() {
    setBidError('')
    const amount = Number(form.amount)
    if (!form.memberId || !amount) { setBidError('Enter a bid amount.'); return }

    // Non-admins can only bid as themselves
    if (!isAdmin && form.memberId !== myMember?.id) {
      setBidError('You can only bid as yourself.')
      return
    }

    setBusy(true)
    const result = await placeBid(selectedItemId, form.memberId, amount)
    setBusy(false)
    if (!result.ok) { setBidError(result.msg); return }
    setModal(null)
  }

  const handleExpired = useCallback(async (itemId) => {
    await supabase.from('items').update({ status: 'ended' }).eq('id', itemId)
  }, [])

  function getTopBid(itemId) {
    const itemBids = bids.filter(b => b.item_id === itemId)
    if (!itemBids.length) return null
    return itemBids.reduce((a, b) => a.amount > b.amount ? a : b)
  }

  const activeItems = items.filter(i => i.status === 'active')
  const endedItems = items.filter(i => i.status === 'ended')
  const selectedItem = items.find(i => i.id === selectedItemId)
  const itemBids = selectedItemId ? bids.filter(b => b.item_id === selectedItemId) : []
  const topBidAmount = itemBids.length ? Math.max(...itemBids.map(b => b.amount)) : 0
  const minNext = Math.max(selectedItem?.min_bid || 0, topBidAmount + 1)

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚔ Auction House</div>
        {isAdmin && <button className="btn btn-gold btn-sm" onClick={openAdd}>+ List Item</button>}
      </div>

      {/* Non-admin with no matched member record */}
      {!isAdmin && !myMember && discordNickname && (
        <div className="error-banner" style={{ marginBottom: 16 }}>
          Your character <b style={{ color: 'var(--gold)' }}>{discordNickname}</b> hasn't been enlisted in the roster yet.
          You can view auctions but cannot bid until your Admiral enlists you.
        </div>
      )}

      {items.length === 0 && (
        <div className="empty-state">No active auctions at the moment.</div>
      )}

      {activeItems.length > 0 && (
        <>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 20, color: 'var(--gold-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
            ⏳ Active Auctions ({activeItems.length})
          </div>
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {activeItems.map(item => {
              const topBid = getTopBid(item.id)
              const topBidder = topBid ? members.find(m => m.id === topBid.member_id) : null
              const count = bids.filter(b => b.item_id === item.id).length
              const canBid = isAdmin || !!myMember
              return (
                <div key={item.id} className="auction-card active">
                  {item.thumbnail_url && (
                    <img src={item.thumbnail_url} alt={item.name}
                      style={{ width: '100%', height: 200, objectFit: 'contain', borderRadius: 50, marginBottom: 10, border: '1px solid var(--border2)' }} />
                  )}
                  <div className="item-name">{item.name}</div>
                  <div style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 8 }}>{item.description || ''}</div>
                  <hr className="divider" style={{ margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 15, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Cinzel,serif' }}>Top Bid</div>
                      <div className="top-bid">{topBid ? topBid.amount.toLocaleString() + ' pts' : '— pts'}</div>
                      <div style={{ fontSize: 20, color: 'var(--text-dim)', marginTop: 2 }}>{topBidder ? topBidder.name : 'No bids yet'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>{count} bid{count !== 1 ? 's' : ''}</div>
                      {canBid && (
                        <button className="btn btn-gold btn-sm" style={{ marginTop: 6 }} onClick={() => openBid(item.id)}>Bid</button>
                      )}
                      {isAdmin && (
                        <button className="btn btn-ghost btn-sm" style={{ marginTop: 4, display: 'block' }} onClick={() => endAuction(item.id)}>End</button>
                      )}
                    </div>
                  </div>
                  <AuctionTimer endTime={item.end_time} durationMs={item.duration_ms} onExpired={() => handleExpired(item.id)} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {endedItems.length > 0 && (
        <>
          <hr className="divider" />
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 20, color: 'var(--text-faint)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
            📜 Closed Auctions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 25 }}>
            {endedItems.map(item => {
              const topBid = getTopBid(item.id)
              const topBidder = topBid ? members.find(m => m.id === topBid.member_id) : null
              return (
                <div key={item.id} className="auction-card ended" style={{ width: 200 }}>
                  {item.thumbnail_url && (
                    <img src={item.thumbnail_url} alt={item.name}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 50, marginBottom: 10, border: '1px solid var(--border2)', filter: 'grayscale(50%)' }} />
                  )}
                  <div className="item-name">{item.name}</div>
                  <div style={{ fontSize: 15, color: 'var(--text-dim)', marginBottom: 8 }}>{item.description}</div>
                  <hr className="divider" style={{ margin: '8px 0' }} />
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Cinzel,serif' }}>Winner</div>
                    <div className="top-bid">{topBid ? topBid.amount.toLocaleString() + ' pts' : '—'}</div>
                    <div style={{ fontSize: 20, color: 'var(--text-dim)' }}>{topBidder ? topBidder.name : 'No bids'}</div>
                  </div>
                  <div className="timer urgent" style={{ marginTop: 8 }}>Auction Ended</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── LIST ITEM MODAL ── */}
      {modal === 'add' && (
        <Modal title="List Item for Auction" onClose={() => setModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Select from Registry
            </label>
            <input value={registrySearch} onChange={e => setRegistrySearch(e.target.value)}
              placeholder="Search items..." style={{ marginBottom: 8 }} />
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border2)', borderRadius: 2 }}>
              {filteredRegistry.length === 0
                ? <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-faint)', fontStyle: 'italic', fontSize: 13 }}>
                    No items found. Add items in Admin → Registry.
                  </div>
                : filteredRegistry.map(item => (
                  <div key={item.id} onClick={() => selectRegistryItem(item)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    background: selectedRegistryItem?.id === item.id ? 'rgba(201,162,39,.1)' : 'transparent',
                    borderLeft: selectedRegistryItem?.id === item.id ? '2px solid var(--gold)' : '2px solid transparent',
                  }}>
                    {item.thumbnail_url
                      ? <img src={item.thumbnail_url} alt={item.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 2, border: '1px solid var(--border2)' }} />
                      : <div style={{ width: 36, height: 36, background: 'var(--surface3)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>⚔</div>
                    }
                    <div>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: selectedRegistryItem?.id === item.id ? 'var(--gold2)' : 'var(--text)' }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.description}</div>}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>

          {selectedRegistryItem && (
            <div style={{ background: 'var(--surface2)', border: '1px solid var(--gold-dim)', borderRadius: 2, padding: 10, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
              {selectedRegistryItem.thumbnail_url && (
                <img src={selectedRegistryItem.thumbnail_url} alt={selectedRegistryItem.name}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 2 }} />
              )}
              <div>
                <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold2)', fontSize: 14 }}>{selectedRegistryItem.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selectedRegistryItem.description}</div>
              </div>
            </div>
          )}

          <div className="form-row">
  <div className="form-group">
    <label>Duration</label>
    <select value={form.duration_ms} onChange={e => setForm(f => ({ ...f, duration_ms: e.target.value }))}>
      <option value="300000">5 Minutes</option>
      <option value="600000">10 Minutes</option>
      <option value="1800000">30 Minutes</option>
      <option value="3600000">1 Hour</option>
      <option value="10800000">3 Hours</option>
      <option value="21600000">6 Hours</option>
      <option value="43200000">12 Hours</option>
      <option value="86400000">24 Hours</option>
      <option value="0">No Timer</option>
    </select>
  </div>
  <div className="form-group">
    <label>Min Bid (pts)</label>
    <input type="number" value={form.min_bid} min={10}
      onChange={e => setForm(f => ({ ...f, min_bid: e.target.value }))} />
  </div>
</div>
<div className="form-group">
  <label>Quantity</label>
  <input
    type="number"
    value={form.quantity}
    min={1}
    max={20}
    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
  />
</div>
          <button className="btn btn-gold btn-full" onClick={handleAdd} disabled={busy || !selectedRegistryItem}>
            {busy ? 'Listing…' : 'List for Auction'}
          </button>
        </Modal>
      )}

      {/* ── BID MODAL ── */}
      {modal === 'bid' && selectedItem && (
        <Modal title={`Place Bid — ${selectedItem.name}`} onClose={() => setModal(null)}>
          {selectedItem.thumbnail_url && (
            <img src={selectedItem.thumbnail_url} alt={selectedItem.name}
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 2, marginBottom: 14, border: '1px solid var(--border2)' }} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', padding: 12, borderRadius: 2, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, fontFamily: 'Cinzel,serif' }}>CURRENT TOP BID</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 22, color: 'var(--gold)' }}>{topBidAmount ? topBidAmount.toLocaleString() + ' pts' : 'No bids'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>MIN NEXT BID</div>
              <div style={{ fontFamily: 'Cinzel,serif', color: 'var(--amber)' }}>{minNext.toLocaleString()} pts</div>
            </div>
          </div>

          {/* Admins see dropdown, members see their own name */}
          <div className="form-group">
            <label>Bidder</label>
            {isAdmin
              ? (
                <select value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.points.toLocaleString()} pts)</option>)}
                </select>
              ) : (
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 2, padding: '8px 10px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text)' }}>{myMember?.name}</span>
                  <span style={{ fontFamily: 'Cinzel,serif', color: 'var(--gold)' }}>{myMember?.points.toLocaleString()} pts available</span>
                </div>
              )
            }
          </div>

          <div className="form-group">
            <label>Bid Amount (pts)</label>
            <input type="number" value={form.amount} min={minNext}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={`Min: ${minNext.toLocaleString()}`} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12, fontStyle: 'italic' }}>
            Previous top bidder's points are refunded automatically when outbid.
          </div>

          {itemBids.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--gold-dim)', letterSpacing: 1, marginBottom: 8 }}>BID HISTORY</div>
              {[...itemBids].sort((a, b) => b.amount - a.amount).slice(0, 5).map(b => {
                const m = members.find(x => x.id === b.member_id)
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{m ? m.name : '?'}</span>
                    <span style={{ color: 'var(--gold)' }}>{b.amount.toLocaleString()} pts</span>
                  </div>
                )
              })}
            </div>
          )}

          {bidError && <div className="error-banner">{bidError}</div>}
          <button className="btn btn-gold btn-full" onClick={handleBid} disabled={busy}>
            {busy ? 'Placing bid…' : 'Place Bid'}
          </button>
        </Modal>
      )}
    </>
  )
}
