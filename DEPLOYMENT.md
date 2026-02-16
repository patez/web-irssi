# Deployment Guide

Complete guide for deploying Web IRSSI to production.

##Outdated just run deploy.sh

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


### 5. Clone Repository

```bash
sudo su - web-irssi
cd ~
git clone <your-repo-url> web-irssi
cd web-irssi
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

#

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

#

3. Check firewall:
```bash
sudo ufw status
```

#
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
