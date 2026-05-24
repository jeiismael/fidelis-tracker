import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import AuctionTimer from '../components/AuctionTimer'
import { supabase } from '../lib/supabase'
import { useCallback } from 'react'

export default function MyBids() {
  const { members, items, bids } = useApp()
  const { discordNickname, isAdmin } = useAuth()

  // Find logged-in user's member record
  const myMember = discordNickname
    ? members.find(m => m.name.toLowerCase() === discordNickname.toLowerCase())
    : null

  if (!myMember) {
    return (
      <div className="empty-state" style={{ marginTop: 40 }}>
        Your character hasn't been enlisted in the roster yet. Contact your Admiral.
      </div>
    )
  }

  // Get all bids placed by this member
  const myBids = bids.filter(b => b.member_id === myMember.id)

  // For each item, find the top bid
  function getTopBid(itemId) {
    const itemBids = bids.filter(b => b.item_id === itemId)
    if (!itemBids.length) return null
    return itemBids.reduce((a, b) => a.amount > b.amount ? a : b)
  }

  function getMyBidAmount(itemId) {
    const mine = myBids.filter(b => b.item_id === itemId)
    if (!mine.length) return null
    return Math.max(...mine.map(b => b.amount))
  }

  // Active auctions where I'm the top bidder
  const activeItems = items.filter(i => i.status === 'active')
  const leadingItems = activeItems.filter(item => {
    const top = getTopBid(item.id)
    return top && top.member_id === myMember.id
  })

  // Active auctions where I bid but I'm NOT the top bidder
  const outbidItems = activeItems.filter(item => {
    const myBidAmount = getMyBidAmount(item.id)
    if (!myBidAmount) return false
    const top = getTopBid(item.id)
    return top && top.member_id !== myMember.id
  })

  // Ended auctions I won
  const wonItems = items.filter(i => {
    if (i.status !== 'ended') return false
    const top = getTopBid(i.id)
    return top && top.member_id === myMember.id
  })

  

  const handleExpired = useCallback(async (itemId) => {
    await supabase.from('items').update({ status: 'ended' }).eq('id', itemId)
  }, [])

  function ItemCard({ item, status }) {
    const topBid = getTopBid(item.id)
    const myBidAmount = getMyBidAmount(item.id)
    const topBidder = topBid ? members.find(m => m.id === topBid.member_id) : null

    const borderColor = status === 'leading' ? 'var(--gold-dim)'
      : status === 'won' ? 'var(--green)'
      : status === 'outbid' ? 'var(--amber)'
      : 'var(--border2)'

    const statusBadge = status === 'leading'
      ? <span className="badge badge-gold">🏅 Leading</span>
      : status === 'won'
      ? <span className="badge badge-green">🏆 Won</span>
      : status === 'outbid'
      ? <span className="badge badge-red">⚠ Outbid</span>
      : <span className="badge badge-dim">Lost</span>

    return (
      <div style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 2, padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start',
      }}>
        {item.thumbnail_url && (
          <img src={item.thumbnail_url} alt={item.name}
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border2)', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontFamily: 'Cinzel,serif', fontSize: 15, color: 'var(--gold2)' }}>{item.name}</div>
            {statusBadge}
          </div>
          {item.description && (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>{item.description}</div>
          )}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>MY BID</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 16, color: 'var(--gold)' }}>{myBidAmount?.toLocaleString()} pts</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>TOP BID</div>
              <div style={{ fontFamily: 'Cinzel,serif', fontSize: 16, color: status === 'outbid' ? 'var(--amber)' : 'var(--gold)' }}>
                {topBid?.amount.toLocaleString()} pts
                {status === 'outbid' && topBidder && (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 6 }}>by {topBidder.name}</span>
                )}
              </div>
            </div>
          </div>
          {item.status === 'active' && item.end_time && (
            <div style={{ marginTop: 8 }}>
              <AuctionTimer endTime={item.end_time} durationMs={item.duration_ms} onExpired={() => handleExpired(item.id)} />
            </div>
          )}
          {item.status === 'ended' && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-faint)', fontStyle: 'italic' }}>
              Auction ended
            </div>
          )}
        </div>
      </div>
    )
  }

  const hasAnyBids = leadingItems.length || outbidItems.length || wonItems.length

  return (
    <>
      <div className="section-header">
        <div className="section-title">⚔ My Bids</div>
        <div style={{ fontFamily: 'Cinzel,serif', fontSize: 13, color: 'var(--gold)' }}>
          {myMember.name} · {myMember.points.toLocaleString()} pts available
        </div>
      </div>

      {!hasAnyBids && (
        <div className="empty-state">You haven't placed any bids yet.</div>
      )}

      {leadingItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--gold-dim)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            🏅 Currently Leading ({leadingItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {leadingItems.map(item => <ItemCard key={item.id} item={item} status="leading" />)}
          </div>
        </div>
      )}

      {outbidItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--amber)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            ⚠ Outbid — Act Fast! ({outbidItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {outbidItems.map(item => <ItemCard key={item.id} item={item} status="outbid" />)}
          </div>
        </div>
      )}

      {wonItems.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--green-light)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            🏆 Won ({wonItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {wonItems.map(item => <ItemCard key={item.id} item={item} status="won" />)}
          </div>
        </div>
      )}

      
    </>
  )
}
