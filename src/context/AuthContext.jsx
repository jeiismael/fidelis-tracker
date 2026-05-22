import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchDiscordRole, getDiscordUserInfo } from '../lib/discord'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [discordNickname, setDiscordNickname] = useState(null)
  const [loading, setLoading] = useState(true)
  const [roleLoading, setRoleLoading] = useState(false)
  const resolvedRef = useRef(false) // prevent multiple resolveRole calls

  useEffect(() => {
    // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session) {
        setSession(session)
        resolveRole(session)
      } else if (event === 'INITIAL_SESSION') {
        setLoading(false)
      }
      } else if (event === 'SIGNED_OUT') {
        resolvedRef.current = false
        setSession(null)
        setUserRole(null)
        setUserInfo(null)
        setDiscordNickname(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(session)
      }
    })

    // Then check for existing session (page reload)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !resolvedRef.current) {
        resolvedRef.current = true
        setSession(session)
        resolveRole(session)
      } else if (!session) {
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
        redirectTo: 'https://fidelisclan.netlify.app',
      },
    })
    if (error) console.error('Discord login error:', error)
  }

  async function logout() {
    resolvedRef.current = false
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