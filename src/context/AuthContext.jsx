import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getDiscordUserInfo } from '../lib/discord'

const AuthContext = createContext(null)
const ROLE_CACHE_KEY = 'fidelis_role_cache'

function getRoleCache(userId) {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw)
    if (cache.userId !== userId) return null
    if (Date.now() - cache.timestamp > 30 * 60 * 1000) return null
    return cache
  } catch { return null }
}

function setRoleCache(userId, role, nickname) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({
      userId, role, nickname, timestamp: Date.now()
    }))
  } catch {}
}

function clearRoleCache() {
  try { localStorage.removeItem(ROLE_CACHE_KEY) } catch {}
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [discordNickname, setDiscordNickname] = useState(null)
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    async function init() {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setSession(session)
        await resolveRole(session)
      } else {
        setLoading(false)
      }

      // Listen for future auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event)
        if (event === 'SIGNED_IN') {
          setSession(session)
          await resolveRole(session)
        } else if (event === 'SIGNED_OUT') {
          clearRoleCache()
          setSession(null)
          setUserRole(null)
          setUserInfo(null)
          setDiscordNickname(null)
          setLoading(false)
        }
      })

      return () => subscription.unsubscribe()
    }

    init()
  }, [])

  async function resolveRole(session) {
    const info = getDiscordUserInfo(session)
    setUserInfo(info)

    // Check localStorage cache first
    const cached = getRoleCache(session.user.id)
    if (cached) {
      console.log('Using cached role:', cached.role)
      setUserRole(cached.role)
      setDiscordNickname(cached.nickname)
      setLoading(false)
      return
    }

    // No cache — fetch from Discord
    setRoleLoading(true)
    console.log('Fetching role for Discord ID:', info.discordId)

    let role = 'denied'
    let nickname = null

    if (info.discordId) {
      try {
        const res = await fetch('/api/check-discord-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordUserId: info.discordId }),
        })
        if (res.ok) {
          const data = await res.json()
          role = data.role || 'denied'
          nickname = data.nickname || null
          console.log('Role:', role, '| Nickname:', nickname)
        }
      } catch (e) {
        console.error('Role fetch error:', e)
      }
    }

    // Cache role in localStorage
    setRoleCache(session.user.id, role, nickname)
    setUserRole(role)
    setDiscordNickname(nickname)

    // Cache in Supabase
    try {
      await supabase.from('user_roles').upsert({
        user_id: session.user.id,
        discord_id: info.discordId,
        discord_username: info.username,
        ingame_name: nickname,
        role,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    } catch (e) {
      console.warn('Could not cache role in Supabase:', e)
    }

    // Auto-link Discord ID to member record
    if (nickname && info.discordId) {
      try {
        const { data: memberRows } = await supabase
          .from('members')
          .select('id, discord_id')
          .ilike('name', nickname)
        if (memberRows && memberRows.length > 0) {
          const member = memberRows[0]
          if (!member.discord_id) {
            await supabase.from('members')
              .update({ discord_id: info.discordId })
              .eq('id', member.id)
          }
        }
      } catch (e) {
        console.warn('Could not link Discord ID:', e)
      }
    }

    setRoleLoading(false)
    setLoading(false)
  }

  async function loginWithDiscord() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify email',
        redirectTo: 'https://fidelisclan.netlify.app',
      },
    })
    if (error) console.error('Discord login error:', error)
  }

  async function logout() {
    clearRoleCache()
    await supabase.auth.signOut()
  }

  const isAdmin = userRole === 'admin'
  const isMember = userRole === 'member' || userRole === 'admin'
  const isDenied = userRole === 'denied'

  return (
    <AuthContext.Provider value={{
      session, userRole, userInfo, discordNickname, loading, roleLoading,
      isAdmin, isMember, isDenied,
      loginWithDiscord, logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
