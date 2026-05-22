import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE flow is more reliable on mobile browsers
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  }
})

export const DISCORD_SERVER_ID = import.meta.env.VITE_DISCORD_SERVER_ID
export const DISCORD_ADMIN_ROLE = import.meta.env.VITE_DISCORD_ADMIN_ROLE || 'Admiral'
export const DISCORD_MEMBER_ROLE = import.meta.env.VITE_DISCORD_MEMBER_ROLE || 'Fidelis'
