#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# RescueMe — Server Bootstrap Script
# Run this ONCE on a fresh Ubuntu 22.04 DigitalOcean Droplet as root.
# Usage: bash scripts/deploy.sh YOUR_DOMAIN
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DOMAIN="${1:-rescueme.asia}"
if [ -z "$DOMAIN" ]; then
  echo "Usage: bash scripts/deploy.sh [domain]"
  echo "Default domain: rescueme.asia"
  exit 1
fi

echo "========================================="
echo "  RescueMe Server Bootstrap"
echo "  Domain: $DOMAIN"
echo "========================================="

# ─── 1. System update ────────────────────────────────────────────────────────
echo "[1/8] Updating system..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw certbot python3-certbot-nginx

# ─── 2. Install Docker ───────────────────────────────────────────────────────
echo "[2/8] Installing Docker..."
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin

# ─── 3. Firewall ─────────────────────────────────────────────────────────────
echo "[3/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ─── 4. Clone repository ─────────────────────────────────────────────────────
echo "[4/8] Cloning repository..."
mkdir -p /opt/rescue-me
cd /opt/rescue-me

if [ ! -d ".git" ]; then
  git clone https://github.com/YOUR_GITHUB_USERNAME/rescue-me-web.git .
else
  git pull origin main
fi

# ─── 5. Setup environment files ──────────────────────────────────────────────
echo "[5/8] Setting up environment files..."
echo ""
echo ">>> ACTION REQUIRED: Copy and fill in .env.production for backend"
echo "    cp backend/.env.production.example backend/.env.production"
echo "    nano backend/.env.production"
echo ""
echo ">>> ACTION REQUIRED: Copy and fill in .env.production for frontend"
echo "    cp frontend/.env.production.example frontend/.env.production"
echo "    nano frontend/.env.production"
echo ""
read -rp "Press ENTER after you have filled in BOTH .env.production files..."

# Source frontend env vars so they're available as build args in docker-compose
set -a
source frontend/.env.production
set +a

# ─── 6. Update nginx config with actual domain ───────────────────────────────
echo "[6/8] Configuring Nginx for domain: $DOMAIN..."
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" nginx/nginx.conf

# ─── 7. Get SSL certificate ──────────────────────────────────────────────────
echo "[7/8] Obtaining SSL certificate from Let's Encrypt..."
# Start a temporary nginx to complete ACME challenge
mkdir -p /var/www/certbot
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "ducntgch221177@fpt.edu.vn" \
  -d "$DOMAIN" \
  -d "www.${DOMAIN}"

# Setup auto-renewal
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/rescue-me/docker-compose.prod.yml restart nginx") | crontab -

# ─── 8. Build and start Docker Compose ───────────────────────────────────────
echo "[8/8] Building and starting services..."
docker compose -f docker-compose.prod.yml up -d --build

# Wait for backend to be ready
echo "Waiting for backend to start..."
sleep 15

# Seed admin user
docker compose -f docker-compose.prod.yml exec -T backend npm run seed:admin || true

echo ""
echo "========================================="
echo "  ✅ Deployment complete!"
echo "  🌐 https://$DOMAIN"
echo "========================================="
echo ""
echo "Useful commands:"
echo "  docker compose -f docker-compose.prod.yml logs -f          # View all logs"
echo "  docker compose -f docker-compose.prod.yml logs -f backend  # Backend logs"
echo "  docker compose -f docker-compose.prod.yml restart backend  # Restart backend"
echo "  docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d --build  # Redeploy"
