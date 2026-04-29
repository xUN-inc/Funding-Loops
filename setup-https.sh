#!/usr/bin/env bash
# setup-https.sh — Nginx + Let's Encrypt HTTPS for a local app
# Usage: bash setup-https.sh [APP_PORT] [EMAIL]
#   APP_PORT defaults to 4000
#   EMAIL    defaults to prompting interactively

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── Args ─────────────────────────────────────────────────────────────────────
APP_PORT="${1:-4000}"
EMAIL="${2:-}"

# ── Detect public IP ──────────────────────────────────────────────────────────
info "Detecting public IP..."
PUBLIC_IP="$(curl -fsSL --max-time 5 https://api.ipify.org \
           || curl -fsSL --max-time 5 https://ifconfig.me \
           || curl -fsSL --max-time 5 https://icanhazip.com)" \
  || die "Could not detect public IP. Pass it manually: PUBLIC_IP=1.2.3.4 bash $0"

DOMAIN="${PUBLIC_IP}.nip.io"
info "Public IP : ${PUBLIC_IP}"
info "Domain    : ${DOMAIN}"
info "App port  : ${APP_PORT}"
echo

# ── Email ─────────────────────────────────────────────────────────────────────
if [[ -z "$EMAIL" ]]; then
  read -rp "Enter your email for Let's Encrypt notifications: " EMAIL
fi
[[ "$EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]] || die "Invalid email: $EMAIL"

# ── Root check ────────────────────────────────────────────────────────────────
[[ "$EUID" -eq 0 ]] || die "Run as root or with sudo: sudo bash $0"

# ── Verify app is listening ───────────────────────────────────────────────────
info "Checking app is running on port ${APP_PORT}..."
if ! ss -tlnp | grep -q ":${APP_PORT}"; then
  warn "Nothing detected on port ${APP_PORT}. Make sure your app is running before testing HTTPS."
  warn "Continuing anyway..."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 1. Install packages
# ─────────────────────────────────────────────────────────────────────────────
info "Updating apt and installing nginx + certbot..."
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx
success "Packages installed."

# ─────────────────────────────────────────────────────────────────────────────
# 2. Open firewall ports (UFW — skip gracefully if not active)
# ─────────────────────────────────────────────────────────────────────────────
info "Configuring UFW firewall..."
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp  >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw reload        >/dev/null
  success "UFW: ports 80 and 443 opened."
else
  warn "UFW not active — skipping. If you use a cloud firewall (AWS/GCP/Azure/DO) open ports 80 and 443 there manually."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Write Nginx config (HTTP only — certbot will add SSL block)
# ─────────────────────────────────────────────────────────────────────────────
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
info "Writing Nginx config to ${NGINX_CONF}..."

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass         http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site, remove default if it conflicts
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"

if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
  info "Removed default Nginx site."
fi

nginx -t || die "Nginx config test failed — check ${NGINX_CONF}"
systemctl enable nginx --quiet
systemctl reload nginx
success "Nginx configured and reloaded."

# ─────────────────────────────────────────────────────────────────────────────
# 4. Obtain SSL certificate
# ─────────────────────────────────────────────────────────────────────────────
info "Requesting SSL certificate from Let's Encrypt..."
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --redirect \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  || die "Certbot failed. Common causes:
  - Port 80 is blocked by your cloud firewall (open it in the cloud console)
  - The domain ${DOMAIN} does not resolve to ${PUBLIC_IP} (nip.io may be down)
  - Rate limit hit (try again in an hour)"

systemctl reload nginx
success "SSL certificate issued and Nginx reloaded."

# ─────────────────────────────────────────────────────────────────────────────
# 5. Verify auto-renewal timer
# ─────────────────────────────────────────────────────────────────────────────
info "Testing certificate auto-renewal (dry run)..."
certbot renew --dry-run --quiet && success "Auto-renewal dry run passed." \
  || warn "Dry run failed — check: sudo certbot renew --dry-run"

# ─────────────────────────────────────────────────────────────────────────────
# 6. Final check
# ─────────────────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  HTTPS setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "  App URL  : ${CYAN}https://${DOMAIN}${NC}"
echo -e "  HTTP     : redirects → HTTPS automatically"
echo -e "  Cert     : /etc/letsencrypt/live/${DOMAIN}/"
echo -e "  Renewal  : managed by systemd certbot.timer (runs twice daily)"
echo
info "Verifying HTTPS response..."
HTTP_CODE="$(curl -o /dev/null -s -w '%{http_code}' --max-time 10 "https://${DOMAIN}" || true)"
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
  success "HTTPS is live — got HTTP ${HTTP_CODE}"
else
  warn "Got HTTP ${HTTP_CODE} — your app may not be running on port ${APP_PORT} yet."
  warn "Start your app and visit: https://${DOMAIN}"
fi
