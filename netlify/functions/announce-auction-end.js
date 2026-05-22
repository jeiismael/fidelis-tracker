/**
 * Netlify function: announce-auction-end
 * Posts an auction result announcement in a Discord channel, tagging the winner.
 */
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
  const CHANNEL_ID = process.env.DISCORD_AUCTION_CHANNEL_ID

  if (!BOT_TOKEN || !CHANNEL_ID) {
    return new Response(JSON.stringify({ error: 'Bot token or channel ID not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  let itemName, winnerDiscordId, winnerName, amount, noBids
  try {
    const body = await req.json()
    itemName = body.itemName
    winnerDiscordId = body.winnerDiscordId
    winnerName = body.winnerName
    amount = body.amount
    noBids = body.noBids || false
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let message
    if (noBids) {
      message = [
        `⚔ **Auction Ended**`,
        ``,
        `**${itemName}** received no bids and has been closed.`,
      ].join('\n')
    } else {
      message = [
        `⚔ **Auction Ended!**`,
        ``,
        `🏆 ${winnerDiscordId ? `<@${winnerDiscordId}>` : `**${winnerName}**`} won **${itemName}** for **${Number(amount).toLocaleString()} pts**!`,
        ``,
        `Congratulations to our victor! ⚔`,
      ].join('\n')
    }

    const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Failed to post announcement:', err)
      return new Response(JSON.stringify({ ok: false, error: err }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Error announcing auction end:', err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = { path: '/api/announce-auction-end' }
