# Deployment

> One Express process serves both the API and the Vite-built React bundle from `public/`. Single port, single PM2 entry. CI builds, then SSHes into the VM and runs `script.sh` to pull-build-restart.

```
GitHub push → CI (ci.yml: lint+build) → Deploy (deploy.yml: ssh)
                                              │
                                              ▼
                                         VM (Ubuntu)
                                         ├─ git pull origin main
                                         ├─ npm ci  (root + client via postinstall)
                                         ├─ vite build → public/
                                         └─ pm2 startOrReload ecosystem.config.cjs
```

---

## 1. One-time VM setup

A small VM (e.g. DigitalOcean $6/mo droplet, AWS t3.micro, Hetzner CX22) is plenty.

### a) System packages

```bash
sudo apt update && sudo apt install -y curl git build-essential

# Node 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (process manager) globally
sudo npm install -g pm2
```

Verify:

```bash
node --version    # v20.x.x
npm  --version
pm2  --version
```

### b) Clone the repo

Pick a stable path; `script.sh` defaults to `$(dirname $0)` so any path works.

```bash
mkdir -p ~/follow-the-money
cd ~/follow-the-money
git clone https://github.com/AkshunChauhan/Agency-Challenge-3.git .
# The app lives in app/
cd app
```

### c) Configure secrets on the VM

```bash
cp .env.example .env
nano .env          # fill in DATABASE_URL and GEMINI_API_KEY
chmod 600 .env     # owner-only
```

`.env` lives **only** on the VM. It's gitignored and is **never** synced from CI. If you rotate keys, edit it on the VM directly.

### d) First boot

```bash
./script.sh
```

This installs deps, builds the React client, starts the PM2 process, and saves the PM2 state.

### e) Survive reboots

Tell PM2 to register a systemd service so the app comes back after a reboot:

```bash
pm2 startup        # follow the printed command (it sudo-installs the unit)
pm2 save           # snapshot the current process list
```

### f) Open the firewall

If you want users to reach the app at `http://VM_IP:3000`:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3000/tcp
sudo ufw enable
```

For **port 80 + HTTPS**, install nginx and put it in front of PM2 (see [nginx + HTTPS](#optional-nginx--https) below).

---

## 2. Wire up GitHub Actions (CD)

### a) Create an SSH deploy key

On the VM:

```bash
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy           # copy the PRIVATE key — paste into GitHub
```

### b) Add repo secrets on GitHub

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value | Required |
|---|---|---|
| `SSH_HOST` | VM public IP or hostname | yes |
| `SSH_USER` | username on the VM (e.g. `ubuntu`, `deploy`) | yes |
| `SSH_PRIVATE_KEY` | contents of `~/.ssh/github_deploy` (the private key) | yes |
| `SSH_PORT` | SSH port — only set if not 22 | no |
| `DEPLOY_PATH` | absolute path to `app/` on the VM (e.g. `/home/ubuntu/follow-the-money/app`) | yes |
| `PUBLIC_URL` | base URL of the deployed app (e.g. `http://1.2.3.4:3000`) — used by the post-deploy health check | optional |

### c) Push to main

A push to `main` will:
1. Run `ci.yml` (lint + syntax-check + Vite build) on Ubuntu.
2. If green, run `deploy.yml` → SSH into the VM → `cd $DEPLOY_PATH && BRANCH=main ./script.sh`.
3. Hit `$PUBLIC_URL/api/health` (if set) until it returns 200 or a 60s timeout fires.

You can also trigger the deploy manually: Actions tab → **Deploy to VM** → Run workflow.

---

## 3. Day-to-day ops

### Deploy by hand

```bash
ssh user@VM_IP
cd ~/follow-the-money/app
./script.sh
```

### Tail logs

```bash
pm2 logs follow-the-money              # live tail (stdout + stderr)
pm2 logs follow-the-money --lines 200  # last 200 lines
tail -f logs/out.log logs/error.log    # raw files
```

### Restart / reload

```bash
pm2 reload follow-the-money    # zero-downtime
pm2 restart follow-the-money   # hard restart
pm2 stop follow-the-money      # stop without removing
pm2 delete follow-the-money    # remove from PM2
```

### Rollback to a previous commit

```bash
cd ~/follow-the-money/app
git fetch origin
SKIP_PULL=1 git checkout <SHA>     # check out the known-good SHA
SKIP_PULL=1 ./script.sh            # build + restart from that tree
```

### Status / inspect

```bash
pm2 status
pm2 describe follow-the-money      # full process info (uptime, restarts, env, etc.)
pm2 monit                          # live CPU/RAM TUI
curl http://localhost:3000/api/health
```

---

## 4. Optional: nginx + HTTPS

Run Express on `127.0.0.1:3000`, put nginx in front to terminate TLS on `:443`:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/follow-the-money`:

```nginx
server {
  server_name your-domain.example.com;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }

  listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/follow-the-money /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.example.com   # auto-issue + renew
```

---

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `pm2: command not found` on VM | PM2 not installed globally | `sudo npm install -g pm2` |
| `script.sh` fails at "Pull latest" | wrong branch name or detached HEAD | `cd $DEPLOY_PATH && git status; git checkout main` |
| `script.sh` fails at "Install dependencies" | `package-lock.json` mismatch | run `npm install` once locally, commit lockfile, retry |
| GH Action fails with `Permission denied (publickey)` | wrong SSH user/key/port | re-check `SSH_USER`, paste the **full** private key including `-----BEGIN/END-----` lines |
| GH Action passes but site is down | PM2 crashed after deploy | `ssh` in, `pm2 logs follow-the-money --lines 200` |
| Site loads, but `/api/loops` 500s | DB connection issue or `.env` missing | `pm2 describe follow-the-money` (check env), `cat .env`, hit `/api/health` |
| Memos all say "Analysis unavailable" | bad/missing `GEMINI_API_KEY` | edit `.env`, then `pm2 reload follow-the-money --update-env` |

---

## Files in this deployment

| File | Purpose |
|---|---|
| [`script.sh`](script.sh) | Pull → install → build → PM2 reload. Idempotent. |
| [`ecosystem.config.cjs`](ecosystem.config.cjs) | PM2 process definition (one Express app, fork mode, autorestart). |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Lint + build on every push/PR. Also reusable by deploy.yml. |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | On push to `main`: gate on CI → SSH into VM → run `script.sh` → health check. |
| [`.env.example`](.env.example) | Template for `.env`. Real `.env` lives only on the VM. |
