// PM2 process definition. One process — Express serves both the API and the
// Vite-built React bundle from public/, so no separate frontend process.
//
// Usage:
//   pm2 start ecosystem.config.cjs            # cold start
//   pm2 reload ecosystem.config.cjs           # zero-downtime reload
//   pm2 startOrReload ecosystem.config.cjs    # idempotent (used by script.sh)
//   pm2 save && pm2 startup                   # survive VM reboots

module.exports = {
  apps: [
    {
      name: 'follow-the-money',
      script: 'server.js',
      cwd: __dirname,
      // Single instance; the in-process caches (loop pool, memos, loop
      // detail) wouldn't survive cluster mode without external state.
      exec_mode: 'fork',
      instances: 1,
      // Auto-restart on crash, with exponential backoff. Postgres
      // hiccups already handled inside server.js (pool error handler);
      // this catches the worst-case unhandled crash.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 4000,
      // Memory ceiling — restart if leaked above this.
      max_memory_restart: '512M',
      // Logs (PM2 also rotates if pm2-logrotate is installed).
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
      // Env applied on top of process.env (which already has .env via dotenv).
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
