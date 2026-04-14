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
    },
  ],
}
