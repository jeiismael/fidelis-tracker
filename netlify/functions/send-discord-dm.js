/**
 * Netlify function: send-discord-dm
 * Sends a Discord DM to a user via the bot token.
 * Called internally by other functions when bid/auction events occur.
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  if (!BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  let discordUserId, message
  try {
    const body = await req.json()
    discordUserId = body.discordUserId
    message = body.message
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!discordUserId || !message) {
    return new Response(JSON.stringify({ error: 'Missing discordUserId or message' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Step 1: Create a DM channel with the user
    const dmChannelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    })

    if (!dmChannelRes.ok) {
      const err = await dmChannelRes.text()
      console.error('Failed to create DM channel:', err)
      return new Response(JSON.stringify({ ok: false, error: err }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    const dmChannel = await dmChannelRes.json()

    // Step 2: Send the message
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    })

    if (!msgRes.ok) {
      const err = await msgRes.text()
      console.error('Failed to send DM:', err)
      return new Response(JSON.stringify({ ok: false, error: err }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Error sending DM:', err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/send-discord-dm' }
