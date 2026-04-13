import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL)        throw new Error('SUPABASE_URL não definida')
if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY não definida')

// service_role — acesso total, sem RLS
// NUNCA expor esta key no frontend
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export default supabase
export { supabase }
