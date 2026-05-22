export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  const SERVER_ID = process.env.DISCORD_SERVER_ID
  const ADMIN_ROLE = process.env.DISCORD_ADMIN_ROLE || 'Admiral'
  const MEMBER_ROLE = process.env.DISCORD_MEMBER_ROLE || 'Fidelis'

  if (!BOT_TOKEN || !SERVER_ID) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let discordUserId, fetchNickname
  try {
    const body = await req.json()
    discordUserId = body.discordUserId
    fetchNickname = body.fetchNickname || false
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!discordUserId) {
    return new Response(JSON.stringify({ error: 'Missing discordUserId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Fetch member from Discord server
    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${SERVER_ID}/members/${discordUserId}`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    )

    if (!memberRes.ok) {
      console.error('Member fetch failed:', memberRes.status)
      return new Response(JSON.stringify({ role: 'denied', nickname: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const member = await memberRes.json()
    const userRoleIds = member.roles || []

    // Get nickname (set by bot to their in-game name)
    const nickname = member.nick || member.user?.username || null
    console.log('Member nickname:', nickname)

    // If only fetching nickname, return early
    if (fetchNickname) {
      return new Response(JSON.stringify({ nickname }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch guild roles to resolve IDs -> names
    const guildRolesRes = await fetch(
      `https://discord.com/api/v10/guilds/${SERVER_ID}/roles`,
      { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
    )

    if (!guildRolesRes.ok) {
      return new Response(JSON.stringify({ role: 'denied', nickname }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const guildRoles = await guildRolesRes.json()
    const roleMap = {}
    guildRoles.forEach(r => { roleMap[r.id] = r.name })

    const userRoleNames = userRoleIds.map(id => roleMap[id]).filter(Boolean)
    console.log('User role names:', userRoleNames)

    let role = 'denied'
    if (userRoleNames.includes(ADMIN_ROLE)) role = 'admin'
    else if (userRoleNames.includes(MEMBER_ROLE)) role = 'member'

    return new Response(JSON.stringify({ role, nickname, roleNames: userRoleNames }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ role: 'denied', nickname: null, error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/check-discord-role' }
