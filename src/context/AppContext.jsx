import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [members, setMembers] = useState([])
  const [events, setEvents] = useState([])
  const [items, setItems] = useState([])
  const [bids, setBids] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  // ── Initial data fetch ──────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const [m, e, i, b, a] = await Promise.all([
        supabase.from('members').select('*').order('points', { ascending: false }),
        supabase.from('events').select('*').order('created_at', { ascending: false }),
        supabase.from('items').select('*').order('created_at', { ascending: false }),
        supabase.from('bids').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance').select('*'),
      ])
      if (m.data) setMembers(m.data)
      if (e.data) setEvents(e.data)
      if (i.data) setItems(i.data)
      if (b.data) setBids(b.data)
      if (a.data) setAttendance(a.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  // ── Real-time listeners ─────────────────────────────────────
  const handleMembersChange = useCallback(() => {
    supabase.from('members').select('*').order('points', { ascending: false })
      .then(({ data }) => { if (data) setMembers(data) })
  }, [])

  const handleBidsChange = useCallback(() => {
    supabase.from('bids').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setBids(data) })
  }, [])

  const handleItemsChange = useCallback(() => {
    supabase.from('items').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setItems(data) })
  }, [])

  const handleAttendanceChange = useCallback(() => {
    supabase.from('attendance').select('*')
      .then(({ data }) => { if (data) setAttendance(data) })
  }, [])

  const handleEventsChange = useCallback(() => {
    supabase.from('events').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setEvents(data) })
  }, [])

  useRealtime('members', handleMembersChange)
  useRealtime('bids', handleBidsChange)
  useRealtime('items', handleItemsChange)
  useRealtime('attendance', handleAttendanceChange)
  useRealtime('events', handleEventsChange)

  // ── Toast helper ────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── MEMBERS ─────────────────────────────────────────────────
  async function addMember({ name, rank, points }) {
    const { error } = await supabase.from('members').insert({ name, rank, points })
    if (error) { showToast('Error: ' + error.message); return false }
    showToast(`${name} enlisted!`)
    return true
  }

  async function updateMember(id, updates) {
    const { error } = await supabase.from('members').update(updates).eq('id', id)
    if (error) { showToast('Error: ' + error.message); return false }
    showToast('Member updated')
    return true
  }

  async function removeMember(id) {
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) { showToast('Error: ' + error.message); return false }
    showToast('Member removed')
    return true
  }

  // ── POINTS LOG ──────────────────────────────────────────────
  async function logPoints(memberId, amount, type, reason) {
    await supabase.from('points_log').insert({ member_id: memberId, amount, type, reason })
  }

  async function adjustPoints(id, type, amount) {
    const member = members.find(m => m.id === id)
    if (!member) return false
    let newPoints = member.points
    let delta = 0
    if (type === 'add') { delta = amount; newPoints += amount }
    else if (type === 'sub') { delta = -Math.min(amount, member.points); newPoints = Math.max(0, newPoints - amount) }
    else if (type === 'set') { delta = amount - member.points; newPoints = Math.max(0, amount) }
    const { error } = await supabase.from('members').update({ points: newPoints }).eq('id', id)
    if (error) { showToast('Error: ' + error.message); return false }
    await logPoints(id, delta, type === 'add' ? 'manual_add' : type === 'sub' ? 'manual_sub' : 'manual_set', 'Manual adjustment by Admiral')
    showToast(`Points updated: ${newPoints.toLocaleString()} pts`)
    return true
  }

  // ── EVENTS ──────────────────────────────────────────────────
  async function createEvent({ name, type, date, points_reward }) {
    const { error } = await supabase.from('events').insert({ name, type, date, points_reward })
    if (error) { showToast('Error: ' + error.message); return false }
    showToast(`Event "${name}" created`)
    return true
  }

  async function removeEvent(id) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { showToast('Error: ' + error.message); return false }
    showToast('Event removed')
    return true
  }

  // Generate a check-in code for an event (expires in 1 hour)
  async function generateCheckinCode(eventId) {
    const event = events.find(e => e.id === eventId)
    const prefixMap = {
      'World Boss': 'WB',
      "Sindri's Island": 'SI',
      'Server Battle': 'SB',
      'Clan Sanctuary': 'CS',
      'Clan Battle': 'CB',
      'Special Event': 'SE',
    }
    const prefix = prefixMap[event?.type] || 'EV'
    const code = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
    const { error } = await supabase.from('events')
      .update({ checkin_code: code, checkin_expires_at: expires })
      .eq('id', eventId)
    if (error) { showToast('Error: ' + error.message); return null }
    showToast(`Check-in code generated: ${code}`)
    return code
  }

  // Member self check-in using a code
  async function checkinWithCode(code, memberId) {
    // Find event with matching code
    const event = events.find(e =>
      e.checkin_code === code.trim().toUpperCase() &&
      !e.locked
    )
    if (!event) return { ok: false, msg: 'Invalid or expired code.' }

    // Check if code is expired
    if (event.checkin_expires_at && new Date(event.checkin_expires_at) < new Date()) {
      return { ok: false, msg: 'This check-in code has expired.' }
    }

    // Check if already checked in
    const already = attendance.find(a => a.event_id === event.id && a.member_id === memberId)
    if (already) return { ok: false, msg: 'You have already checked in to this event.' }

    // Mark attendance
    const { error } = await supabase.from('attendance').insert({
      event_id: event.id,
      member_id: memberId,
    })
    if (error) return { ok: false, msg: error.message }

    showToast(`Checked in to "${event.name}"!`)
    return { ok: true, event }
  }

  // ── ATTENDANCE ──────────────────────────────────────────────
  async function toggleAttendance(eventId, memberId) {
    const exists = attendance.find(a => a.event_id === eventId && a.member_id === memberId)
    if (exists) {
      await supabase.from('attendance').delete().eq('id', exists.id)
    } else {
      await supabase.from('attendance').insert({ event_id: eventId, member_id: memberId })
    }
  }

  async function markAllAttendance(eventId) {
    const existing = attendance.filter(a => a.event_id === eventId).map(a => a.member_id)
    const toInsert = members
      .filter(m => !existing.includes(m.id))
      .map(m => ({ event_id: eventId, member_id: m.id }))
    if (toInsert.length) await supabase.from('attendance').insert(toInsert)
  }

  async function clearAllAttendance(eventId) {
    await supabase.from('attendance').delete().eq('event_id', eventId)
  }

  async function lockEvent(eventId) {
    const event = events.find(e => e.id === eventId)
    if (!event) return false
    const attendees = attendance.filter(a => a.event_id === eventId)

    // Award points to all attendees
    for (const a of attendees) {
      const member = members.find(m => m.id === a.member_id)
      if (member) {
        await supabase.from('members')
          .update({ points: member.points + event.points_reward })
          .eq('id', member.id)
        await logPoints(member.id, event.points_reward, 'attendance', `Attended: ${event.name}`)
      }
    }

    // Lock event
    await supabase.from('events').update({ locked: true }).eq('id', eventId)
    showToast(`Event locked — ${attendees.length} members awarded ${event.points_reward} pts each`)
    return true
  }

  // ── ITEMS / AUCTIONS ────────────────────────────────────────
  async function addItem({ name, description, min_bid, duration_ms, thumbnail_url = null }) {
    const end_time = duration_ms > 0
      ? new Date(Date.now() + duration_ms).toISOString()
      : null
    const { error } = await supabase.from('items').insert({
      name, description, min_bid, status: 'active', end_time, duration_ms, thumbnail_url
    })
    if (error) { showToast('Error: ' + error.message); return false }
    showToast(`"${name}" listed for auction`)
    return true
  }

  // ── NOTIFICATIONS ───────────────────────────────────────────
  async function createNotification(memberId, title, message, type) {
    await supabase.from('notifications').insert({ member_id: memberId, title, message, type })
  }

  async function sendDiscordDM(discordId, message) {
    if (!discordId) return
    try {
      await fetch('/api/send-discord-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUserId: discordId, message }),
      })
    } catch (e) {
      console.warn('Discord DM failed:', e)
    }
  }

  async function notifyMember(memberId, title, message, type, discordMessage) {
    // In-app notification
    await createNotification(memberId, title, message, type)
    // Discord DM — look up discord_id from members table
    const member = members.find(m => m.id === memberId)
    if (member?.discord_id) {
      await sendDiscordDM(member.discord_id, discordMessage || message)
    }
  }

  // ── ITEMS / AUCTIONS ────────────────────────────────────────
 async function endAuction(id) {
  // Use a single atomic update that only succeeds if status is still 'active'
  const { data, error } = await supabase
    .from('items')
    .update({ status: 'ended' })
    .eq('id', id)
    .eq('status', 'active') // Only update if still active
    .select()

  if (error || !data || data.length === 0) {
    // Either error or item was already ended — stop here
    return false
  }

  const item = data[0]
showToast('Auction ended')

if (item) {
  // Fetch fresh bids from DB instead of relying on potentially stale state
  const { data: freshBids } = await supabase
    .from('bids')
    .select('*')
    .eq('item_id', id)

  const itemBids = freshBids || []

        // Notify winner (in-app + Discord DM)
if (winner) {
  await notifyMember(
    winner.id,
    '🏆 You won an auction!',
    `You won "${item.name}" for ${topBidEntry.amount.toLocaleString()} pts!`,
    'win',
    `🏆 Congratulations! You won the auction for **${item.name}** with a bid of **${topBidEntry.amount.toLocaleString()} pts**!`
  )
  await logPoints(winner.id, 0, 'win', `Won: ${item.name} (${topBidEntry.amount.toLocaleString()} pts)`)
}

        // Notify admiral (in-app + Discord DM)
        const adminMembers = members.filter(m => m.rank === 'Officer' || m.rank === 'Admiral')
        for (const admin of adminMembers) {
          if (admin.id !== winner?.id) {
            await notifyMember(
              admin.id,
              '⚔ Auction Ended',
              `"${item.name}" was won by ${winner?.name || 'Unknown'} for ${topBidEntry.amount.toLocaleString()} pts.`,
              'auction_ended',
              `⚔ Auction ended: **${item.name}** was won by **${winner?.name || 'Unknown'}** for **${topBidEntry.amount.toLocaleString()} pts**.`
            )
          }
        }

        // Post announcement in Discord channel tagging the winner
        try {
          await fetch('/api/announce-auction-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemName: item.name,
              winnerDiscordId: winner?.discord_id || null,
              winnerName: winner?.name || 'Unknown',
              amount: topBidEntry.amount,
              noBids: false,
            }),
          })
        } catch (e) {
          console.warn('Channel announcement failed:', e)
        }

      } else {
        // No bids — post a no-bids announcement
        try {
          await fetch('/api/announce-auction-end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemName: item.name,
              noBids: true,
            }),
          })
        } catch (e) {
          console.warn('Channel announcement failed:', e)
        }
      }
    }
    return true
  }

  async function removeItem(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { showToast('Error: ' + error.message); return false }
    showToast('Item removed')
    return true
  }

  // ── BIDS ────────────────────────────────────────────────────
  async function placeBid(itemId, memberId, amount) {
  // Fetch fresh item status from DB to avoid race condition with pg_cron
  const { data: freshItem } = await supabase
    .from('items').select('*').eq('id', itemId).single()
  const item = freshItem
  const member = members.find(m => m.id === memberId)
  if (!item || !member) return { ok: false, msg: 'Invalid item or member' }
  if (item.status !== 'active') return { ok: false, msg: 'Auction is closed' }

    const itemBids = bids.filter(b => b.item_id === itemId)
    const topBid = itemBids.length ? Math.max(...itemBids.map(b => b.amount)) : 0
    const minNext = Math.max(item.min_bid || 0, topBid + 10)

    if (amount < minNext) return { ok: false, msg: `Minimum bid is ${minNext.toLocaleString()} pts` }

    // Prevent top bidder from bidding again
    if (itemBids.length) {
      const topBidEntry = itemBids.reduce((a, b) => a.amount > b.amount ? a : b)
      if (topBidEntry.member_id === memberId) {
        return { ok: false, msg: `${member.name} is already the highest bidder.` }
      }
    }

    if (member.points < amount) return { ok: false, msg: `${member.name} only has ${member.points.toLocaleString()} pts` }

    // Refund previous top bidder and notify them
    if (itemBids.length) {
      const topBidEntry = itemBids.reduce((a, b) => a.amount > b.amount ? a : b)
      if (topBidEntry.member_id !== memberId) {
        const { data: freshPrevMember } = await supabase
          .from('members').select('*').eq('id', topBidEntry.member_id).single()
        if (freshPrevMember) {
          await supabase.from('members')
            .update({ points: freshPrevMember.points + topBidEntry.amount })
            .eq('id', freshPrevMember.id)
          await logPoints(freshPrevMember.id, topBidEntry.amount, 'refund', `Outbid refund: ${item.name}`)

          await notifyMember(
            freshPrevMember.id,
            '⚠ You\'ve been outbid!',
            `${member.name} outbid you on "${item.name}" with ${amount.toLocaleString()} pts. Your ${topBidEntry.amount.toLocaleString()} pts have been refunded.`,
            'outbid',
            `⚠ You've been outbid on **${item.name}**! **${member.name}** bid **${amount.toLocaleString()} pts**. Your **${topBidEntry.amount.toLocaleString()} pts** have been refunded. Bid higher to reclaim the top spot!`
          )
        }
      }
    }

    // Fetch fresh points before deducting
    const { data: freshMember } = await supabase
      .from('members').select('points').eq('id', memberId).single()
    const currentPoints = freshMember?.points ?? member.points
    await supabase.from('members').update({ points: currentPoints - amount }).eq('id', memberId)
    await logPoints(memberId, -amount, 'bid', `Bid on: ${item.name}`)

    // Insert bid
    const { error } = await supabase.from('bids').insert({ item_id: itemId, member_id: memberId, amount })
    if (error) return { ok: false, msg: error.message }

    // Auto-extend: if bid placed within last 5 minutes, reset timer to 5 minutes
    if (item.end_time) {
      const timeLeft = new Date(item.end_time).getTime() - Date.now()
      const fiveMinutes = 5 * 60 * 1000
      if (timeLeft < fiveMinutes) {
        const newEndTime = new Date(Date.now() + fiveMinutes).toISOString()
        await supabase.from('items').update({ end_time: newEndTime }).eq('id', itemId)
        showToast(`Bid placed — auction extended to 5 minutes!`)
        return { ok: true }
      }
    }

    showToast(`Bid of ${amount.toLocaleString()} pts placed by ${member.name}`)
    return { ok: true }
  }

  return (
    <AppContext.Provider value={{
      members, events, items, bids, attendance, loading, toast,
      addMember, updateMember, removeMember, adjustPoints,
      createEvent, removeEvent, generateCheckinCode, checkinWithCode,
      toggleAttendance, markAllAttendance, clearAllAttendance, lockEvent,
      addItem, endAuction, removeItem,
      placeBid,
      showToast,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
