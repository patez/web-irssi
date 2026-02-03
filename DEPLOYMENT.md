# Deployment Guide

Complete guide for deploying Web IRSSI to production.

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Initial Setup](#initial-setup)
3. [PM2 Deployment](#pm2-deployment)
4. [Nginx Configuration](#nginx-configuration)
5. [SSL Setup](#ssl-setup)
6. [Firewall Configuration](#firewall-configuration)
7. [Creating Admin User](#creating-admin-user)
8. [Monitoring & Logs](#monitoring--logs)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

## Server Requirements

### Minimum Specs
- **CPU**: 1 core
- **RAM**: 1GB
- **Storage**: 10GB
- **OS**: Ubuntu 20.04+ or Debian 11+

### Recommended Specs
- **CPU**: 2+ cores
- **RAM**: 2GB+
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 24.04 LTS

### Software Requirements
- Node.js 18+
- tmux
- irssi
- nginx (for reverse proxy)
- certbot (for SSL)

## Initial Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install System Dependencies

```bash
sudo apt install -y tmux irssi nginx certbot python3-certbot-nginx \
    build-essential python3 git curl
```

### 3. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:
```bash
node -v  # Should be v20.x.x
npm -v   # Should be 10.x.x
```

### 4. Create Application User

```bash
sudo useradd -m -s /bin/bash web-irssi
sudo usermod -aG sudo web-irssi  # Optional: for admin tasks
```

### 5. Clone Repository

```bash
sudo su - web-irssi
cd ~
git clone <your-repo-url> web-irssi
cd web-irssi
```

### 6. Run Installation Script

```bash
chmod +x install.sh
./install.sh
```

### 7. Configure Environment

```bash
nano .env
```

Edit settings:
```env
PORT=3001
BASE_URL=https://irc.yourdomain.com
IRC_SERVER=irc.libera.chat
IRC_PORT=6667

# Email (required for user activation)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

## PM2 Deployment

### 1. Install PM2 Globally

```bash
sudo npm install -g pm2
```

### 2. Start Application

```bash
cd ~/web-irssi
pm2 start server/index.js --name web-irssi
```

### 3. Configure Startup

```bash
pm2 startup systemd -u web-irssi --hp /home/web-irssi
```

Copy and run the output command (as root).

### 4. Save PM2 Configuration

```bash
pm2 save
```

### 5. Verify Running

```bash
pm2 status
pm2 logs web-irssi
```

### 6. PM2 Ecosystem File (Optional)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'web-irssi',
    script: './server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

Use it:
```bash
pm2 start ecosystem.config.js
pm2 save
```

## Nginx Configuration

### 1. Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/web-irssi
```

Add:
```nginx
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name irc.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name irc.yourdomain.com;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/irc.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/irc.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket endpoint
    location /terminal {
        proxy_pass http://localhost:3001/terminal;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/web-irssi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Open Firewall (if using UFW)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw status
```

## SSL Setup

### 1. Obtain Certificate

```bash
sudo certbot --nginx -d irc.yourdomain.com
```

Follow prompts:
- Enter email
- Agree to ToS
- Choose to redirect HTTP to HTTPS

### 2. Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

### 3. Verify SSL

Visit: https://www.ssllabs.com/ssltest/analyze.html?d=irc.yourdomain.com

## Firewall Configuration

### Using UFW (Ubuntu)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status verbose
```

### Using firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## Creating Admin User

### Method 1: Via Database

```bash
# Access database
sqlite3 ~/web-irssi/users.db

# Create admin user
INSERT INTO users (username, email, password_hash, created_at, is_admin, is_activated, activation_token)
VALUES ('admin', 'admin@yourdomain.com', NULL, strftime('%s','now')*1000, 1, 0, hex(randomblob(32)));

# Get activation token
SELECT username, activation_token FROM users WHERE username = 'admin';

# Exit
.quit
```

Visit: `https://irc.yourdomain.com/activate?token=<activation_token>`

### Method 2: Via API (if you already have an admin)

```bash
curl -X POST https://irc.yourdomain.com/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newadmin",
    "email": "newadmin@example.com",
    "isAdmin": true
  }'
```

## Monitoring & Logs

### PM2 Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs web-irssi

# Monitor in real-time
pm2 monit

# View detailed info
pm2 info web-irssi
```

### Application Logs

```bash
# Via PM2
pm2 logs web-irssi --lines 100

# Via journalctl (if using systemd)
sudo journalctl -u web-irssi -f
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### PM2 Web Dashboard

```bash
pm2 install pm2-server-monit
```

Access: `http://your-server-ip:9615`

## Backup & Recovery

### Database Backup

```bash
# Create backup script
nano ~/backup-web-irssi.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/web-irssi/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
cp /home/web-irssi/web-irssi/users.db $BACKUP_DIR/users_$DATE.db

# Backup environment
cp /home/web-irssi/web-irssi/.env $BACKUP_DIR/env_$DATE.backup

# Keep only last 30 days
find $BACKUP_DIR -name "users_*.db" -mtime +30 -delete
find $BACKUP_DIR -name "env_*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
```

Make executable:
```bash
chmod +x ~/backup-web-irssi.sh
```

### Automated Backups (Cron)

```bash
crontab -e
```

Add:
```bash
# Daily backup at 2 AM
0 2 * * * /home/web-irssi/backup-web-irssi.sh >> /home/web-irssi/backup.log 2>&1
```

### Restore from Backup

```bash
cd ~/web-irssi
pm2 stop web-irssi
cp ~/backups/users_20240101_020000.db ./users.db
pm2 start web-irssi
```

## Troubleshooting

### Server Won't Start

```bash
# Check Node.js
node -v

# Check dependencies
cd ~/web-irssi
npm install

# Check logs
pm2 logs web-irssi --err

# Try starting manually
node server/index.js
```

### WebSocket Connection Fails

1. Check Nginx config:
```bash
sudo nginx -t
sudo systemctl status nginx
```

2. Check WebSocket proxy:
```bash
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:3001/terminal
```

3. Check firewall:
```bash
sudo ufw status
```

### Database Locked

```bash
cd ~/web-irssi
pm2 stop web-irssi
rm users.db-shm users.db-wal
pm2 start web-irssi
```

### High Memory Usage

```bash
# Restart PM2
pm2 restart web-irssi

# Check processes
pm2 monit

# Limit memory in ecosystem.config.js
max_memory_restart: '500M'
```

### Email Not Sending

1. Check .env configuration
2. Test email manually:
```bash
node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: { user: 'your@email.com', pass: 'your-password' }
});
transport.sendMail({
  from: 'your@email.com',
  to: 'test@example.com',
  subject: 'Test',
  text: 'Test email'
}).then(console.log).catch(console.error);
"
```

### Port Already in Use

```bash
# Find process
sudo lsof -i :3001

# Kill process
sudo kill -9 <PID>

# Or change port in .env
```

## Security Checklist

- [ ] SSL certificate installed and auto-renewing
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] Strong passwords for all admin accounts
- [ ] Email configured for notifications
- [ ] Regular backups scheduled
- [ ] Server updated regularly (`sudo apt update && sudo apt upgrade`)
- [ ] PM2 configured for auto-restart
- [ ] Nginx security headers enabled
- [ ] Database file permissions: 644
- [ ] Session directory permissions: 755

## Performance Optimization

### For 50+ Users

1. Increase Node.js memory:
```bash
pm2 delete web-irssi
pm2 start server/index.js --name web-irssi --max-memory-restart 1G
pm2 save
```

2. Optimize Nginx:
```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
}
```

3. Increase system limits:
```bash
sudo nano /etc/security/limits.conf
```
Add:
```
web-irssi soft nofile 65536
web-irssi hard nofile 65536
```

## Updating the Application

```bash
cd ~/web-irssi
git pull origin main
npm install
pm2 restart web-irssi
```

## Complete Uninstall

```bash
# Stop and remove PM2 process
pm2 delete web-irssi
pm2 save

# Remove files
rm -rf ~/web-irssi

# Remove nginx config
sudo rm /etc/nginx/sites-enabled/web-irssi
sudo rm /etc/nginx/sites-available/web-irssi
sudo systemctl reload nginx

# Revoke SSL certificate
sudo certbot revoke --cert-name irc.yourdomain.com
sudo certbot delete --cert-name irc.yourdomain.com
```

## Support

For issues:
- Check logs: `pm2 logs web-irssi`
- Review this guide
- Check GitHub issues
- Contact support

---

*Last updated: 2024*
