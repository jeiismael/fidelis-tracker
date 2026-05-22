/**
 * Fetch a user's guild role by calling our Netlify serverless function.
 * Returns: 'admin' | 'member' | 'denied'
 */
export async function fetchDiscordRole(discordUserId) {
  try {
    if (!discordUserId) {
      console.warn('No Discord user ID provided')
      return 'denied'
    }

    console.log('Checking Discord role for user ID:', discordUserId)

    const res = await fetch('/api/check-discord-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordUserId }),
    })

    if (!res.ok) {
      console.error('Role check function failed:', res.status)
      return 'denied'
    }

    const data = await res.json()
    console.log('Role check result:', data)
    return data.role || 'denied'

  } catch (err) {
    console.error('Error checking Discord role:', err)
    return 'denied'
  }
}

/**
 * Extract user info from Supabase Discord OAuth session.
 * Also fetches the member's current Discord nickname (= in-game name set by bot).
 */
export async function fetchDiscordNickname(discordUserId) {
  try {
    const res = await fetch('/api/check-discord-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordUserId, fetchNickname: true }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.nickname || null
  } catch {
    return null
  }
}

export function getDiscordUserInfo(session) {
  const meta = session?.user?.user_metadata || {}
  return {
    discordId: meta.provider_id || meta.sub || meta.id || '',
    username: meta.full_name || meta.name || meta.custom_claims?.global_name || '',
    avatar: meta.avatar_url || '',
  }
}
