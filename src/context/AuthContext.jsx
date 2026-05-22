import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDiscordRole, getDiscordUserInfo } from '../lib/discord'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [discordNickname, setDiscordNickname] = useState(null) // in-game name from Discord
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) resolveRole(session)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) resolveRole(session)
      else {
        setUserRole(null)
        setUserInfo(null)
        setDiscordNickname(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function resolveRole(session) {
    setRoleLoading(true)
    const info = getDiscordUserInfo(session)
    setUserInfo(info)

    console.log('Discord user ID:', info.discordId)
    /*
    // Check cached role in Supabase (valid for 5 min)
    try {
      const { data: existing } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (existing) {
        const age = Date.now() - new Date(existing.updated_at).getTime()
        if (age < 5 * 60 * 1000) {
          console.log('Using cached role:', existing.role)
          setUserRole(existing.role)
          if (existing.ingame_name) setDiscordNickname(existing.ingame_name)
          setRoleLoading(false)
          setLoading(false)
          return
        }
      }
    } catch (e) {
      // No cached role yet
    }
    */
    // Fetch fresh role + nickname from Discord via Netlify function
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
      console.warn('Could not cache role:', e)
    }

    // Auto-link Discord ID to member record by matching nickname
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
        console.warn('Could not link Discord ID to member:', e)
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
        redirectTo: window.location.origin,
      },
    })
    if (error) console.error('Discord login error:', error)
  }

  async function logout() {
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
