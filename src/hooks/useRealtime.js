import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Subscribe to real-time changes on a Supabase table.
 * Calls `onchange` with the full postgres_changes payload.
 *
 * @param {string} table  - Supabase table name
 * @param {function} onChange - callback(payload) fired on INSERT/UPDATE/DELETE
 */
export function useRealtime(table, onChange) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => onChange(payload)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, onChange])
}
