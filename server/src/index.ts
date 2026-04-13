/**
 * index.ts — Entry point do Sano.ia Server
 *
 * Boot order:
 *  1. Valida env
 *  2. Sobe HTTP
 *  3. Inicializa todos os tenants ativos
 */

import 'dotenv/config'
import { startHttpServer } from './http/server'
import { initAllTenants }  from './tenant/tenant-manager'

function assertEnv(keys: string[]): void {
  const missing = keys.filter(k => !process.env[k])
  if (missing.length > 0) throw new Error(`Env ausente: ${missing.join(', ')}`)
}

async function boot(): Promise<void> {
  console.log('══════════════════════════════════════')
  console.log('       Sano.ia — AI Agent Server      ')
  console.log('══════════════════════════════════════')

  assertEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY'])

  startHttpServer()
  await initAllTenants()

  console.log('[BOOT] Sano.ia pronto.')
}

boot().catch(err => {
  console.error('[BOOT] Falha fatal:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED] Promise rejeitada sem catch:', reason)
})

process.on('uncaughtException', (err: any) => {
  console.error('[UNCAUGHT] Exceção não capturada:', err)
  if (err.code === 'EADDRINUSE') {
    console.error('[UNCAUGHT] Porta já em uso — encerrando processo duplicado.')
    process.exit(1)
  }
})
