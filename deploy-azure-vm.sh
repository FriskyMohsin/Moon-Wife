#!/bin/bash
# Pari AI — Azure VM Deployment Script
# Run this ON the Azure VM (Ubuntu)
# Usage: bash deploy-azure-vm.sh

set -e

echo "🚀 Pari AI Azure VM Deployment"
echo "================================"

# 1. Update system
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 22
echo "📦 Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# Verify
node --version
npm --version

# 3. Install PM2 (process manager)
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. Clone repo (or pull if exists)
APP_DIR="$HOME/pari-ai"
if [ -d "$APP_DIR" ]; then
  echo "📂 Updating existing repo..."
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/pari-ai-client-panel
else
  echo "📂 Cloning repo..."
  git clone -b pari-ai-client-panel https://github.com/FriskyMohsin/Moon-Wife.git "$APP_DIR"
  cd "$APP_DIR"
fi

# 5. Install dependencies
echo "📦 Installing dependencies..."
npm ci --legacy-peer-deps

# 6. Install Playwright browsers (for browser automation)
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium
npx playwright install-deps chromium 2>/dev/null || sudo npx playwright install-deps chromium || true

# 7. Build
echo "🔨 Building..."
npm run build

# 8. Setup PM2
echo "⚙️ Setting up PM2..."
pm2 delete pari-ai 2>/dev/null || true
PORT=3001 pm2 start dist/server.cjs --name pari-ai
pm2 save
pm2 startup | tail -1

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure Nginx reverse proxy for your domain"
echo "2. Setup SSL with: sudo certbot --nginx -d yourdomain.com"
echo "3. Check status: pm2 status"
echo "4. View logs: pm2 logs pari-ai"
