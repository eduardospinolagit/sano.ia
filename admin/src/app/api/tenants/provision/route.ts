/**
 * POST /api/tenants/provision
 *
 * Cria automaticamente tenant + agent para um novo usuário autenticado
 * que ainda não possui tenant. Usa a service key para bypassar RLS.
 * Idempotente: retorna o tenant existente se já houver um.
 */

import { NextResponse }            from 'next/server'
import { createClient }            from '@supabase/supabase-js'
import { createServerClient }      from '@supabase/ssr'
import { cookies }                 from 'next/headers'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return NextResponse.json({ error: 'Variáveis de ambiente não configuradas' }, { status: 500 })
  }

  // Verifica sessão do usuário
  const cookieStore = await cookies()
  const supabaseAuth = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Idempotente: verifica se já tem tenant
  const { data: existing } = await admin
    .from('tenant_members')
    .select('tenant_id, tenants(*)')
    .eq('user_email', user.email!)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (existing?.tenants) {
    return NextResponse.json({ tenant: existing.tenants })
  }

  // Gera slug único a partir do e-mail
  const prefix = user.email!.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const suffix = Date.now().toString(36)
  const slug   = `${prefix}-${suffix}`

  // Cria tenant
  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert({ name: prefix, slug, email: user.email!, status: 'trial' })
    .select()
    .single()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: tenantErr?.message ?? 'Erro ao criar tenant' }, { status: 500 })
  }

  // Vincula usuário como owner (já aceito)
  await admin.from('tenant_members').insert({
    tenant_id:   tenant.id,
    user_email:  user.email!,
    role:        'owner',
    accepted_at: new Date().toISOString(),
  })

  // Cria agente padrão
  await admin.from('agents').insert({
    tenant_id: tenant.id,
    name:      'Agente',
  })

  return NextResponse.json({ tenant })
}
