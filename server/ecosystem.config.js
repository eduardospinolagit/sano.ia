module.exports = {
  apps: [
    {
      name:          'sano-ia',
      script:        'node_modules/tsx/dist/cli.mjs',
      args:          'src/index.ts',
      cwd:           __dirname,
      restart_delay: 3000,
      max_restarts:  20,
      min_uptime:    5000,
      watch:         false,
      kill_timeout:  15000,   // aguarda até 15s após SIGTERM antes de SIGKILL
    },
  ],
}
