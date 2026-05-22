import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

export default function NotificationBell() {
  const { session } = useAuth()
  const { members } = useApp()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)

  // Find current user's member record via user_roles
  const [myMemberId, setMyMemberId] = useState(null)

  useEffect(() => {
    if (!session || !members.length) return
    supabase.from('user_roles').select('discord_id').eq('user_id', session.user.id).single()
  .then(({ data }) => {
    if (!data) return
    console.log('user_roles discord_id:', data.discord_id)
    console.log('members list:', members.map(m => ({ name: m.name, discord_id: m.discord_id })))
    const member = members.find(m => m.discord_id === data.discord_id)
    console.log('matched member:', member)
    if (member) setMyMemberId(member.id)
  })
  }, [session, members])

  const fetchNotifications = useCallback(async () => {
    if (!myMemberId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('member_id', myMemberId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
  }, [myMemberId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Real-time updates
  useEffect(() => {
    if (!myMemberId) return
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.member_id === myMemberId) {
            setNotifications(prev => [payload.new, ...prev].slice(0, 20))
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [myMemberId])

  const unread = notifications.filter(n => !n.read).length

  async function markAllRead() {
    if (!myMemberId) return
    await supabase.from('notifications').update({ read: true }).eq('member_id', myMemberId).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  function typeIcon(type) {
    if (type === 'outbid') return '⚠'
    if (type === 'win') return '🏆'
    if (type === 'auction_ended') return '⚔'
    return '🔔'
  }

  function typeColor(type) {
    if (type === 'outbid') return 'var(--amber)'
    if (type === 'win') return 'var(--gold2)'
    if (type === 'auction_ended') return 'var(--green-light)'
    return 'var(--text-dim)'
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

  if (!myMemberId) return null

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead() }}
        style={{
          background: 'none', border: '1px solid var(--border2)', borderRadius: 2,
          color: unread > 0 ? 'var(--gold2)' : 'var(--text-dim)',
          width: 34, height: 34, cursor: 'pointer', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          transition: 'all .2s',
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: 'var(--red)',
            color: '#fff', borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontFamily: 'Cinzel,serif', fontWeight: 700,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 40, right: 0, width: 320,
            background: 'var(--surface)', border: '1px solid var(--gold-dim)',
            borderRadius: 2, zIndex: 100, maxHeight: 400, overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontFamily: 'Cinzel,serif', fontSize: 11, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase' }}>
                Notifications
              </span>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', fontFamily: 'Cinzel,serif', letterSpacing: 1 }}>
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0
              ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-faint)', fontStyle: 'italic', fontSize: 13 }}>
                  No notifications yet
                </div>
              : notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: '10px 14px', borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'rgba(201,162,39,.05)',
                    cursor: 'pointer', transition: 'background .2s',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>{typeIcon(n.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Cinzel,serif', fontSize: 12, color: typeColor(n.type), marginBottom: 2 }}>
                        {n.title}
                        {!n.read && <span style={{ width: 6, height: 6, background: 'var(--gold)', borderRadius: '50%', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }} />}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  )
}
