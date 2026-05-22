import { useState, useEffect } from 'react'

export default function AuctionTimer({ endTime, durationMs, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    if (!endTime) return
    function calc() {
      const diff = new Date(endTime).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft(null); onExpired?.(); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft({ h, m, s, total: diff })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [endTime, onExpired])

  if (!endTime) return <div className="timer" style={{ color: 'var(--text-faint)' }}>No timer set</div>
  if (!timeLeft) return <div className="timer urgent">Auction Ended</div>

  const pct = Math.min(100, Math.max(0, (timeLeft.total / (durationMs || 3600000)) * 100))
  const urgent = timeLeft.total < 300000

  return (
    <>
      <div className="bid-bar">
        <div className="bid-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className={`timer ${urgent ? 'urgent' : ''}`}>
        {timeLeft.h > 0 ? `${timeLeft.h}h ` : ''}{timeLeft.m}m {timeLeft.s}s remaining
      </div>
    </>
  )
}
