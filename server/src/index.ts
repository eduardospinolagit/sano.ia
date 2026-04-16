/**
 * index.ts — Entry point do Sano.ia Server
 *
 * Boot order:
 *  1. Valida env
 *  2. Sobe HTTP
 *  3. Inicializa todos os tenants ativos
 */

import 'dotenv/config'
import { startHttpServer }                          from './http/server'
import { initAllTenants, startAgentRefreshLoop, getAllRuntimes } from './tenant/tenant-manager'
import { startWatchdog }                            from './jobs/watchdog.job'
import { startFollowupJob }                         from './jobs/followup.job'
import { markShuttingDown, waitForShutdown }        from './pipeline/pipeline'

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
  startWatchdog()
  startFollowupJob()
  startAgentRefreshLoop()

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

// ─── Graceful shutdown ────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[SHUTDOWN] ${signal} recebido — aguardando pipelines em andamento...`)
  markShuttingDown()

  await waitForShutdown(10_000)
  console.log('[SHUTDOWN] Pipelines concluídos — desconectando sessões WA...')

  for (const runtime of getAllRuntimes()) {
    try { runtime.waSession.disconnect() } catch { /* ignora */ }
  }

  console.log('[SHUTDOWN] Encerrado.')
  process.exit(0)
}

process.on('SIGTERM', () => { shutdown('SIGTERM').catch(console.error) })
process.on('SIGINT',  () => { shutdown('SIGINT').catch(console.error) })
