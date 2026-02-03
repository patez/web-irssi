# Web IRSSI - Modern Web-Based IRC Client

A secure, multi-user web terminal for IRSSI with persistent sessions, user management, and admin panel.

## Features

- 🔐 **Secure Authentication** - JWT-based sessions with bcrypt password hashing
- 👥 **Multi-User Support** - Each user gets isolated IRSSI sessions
- 📱 **Mobile Friendly** - Responsive design with touch support
- 🔄 **Persistent Sessions** - Sessions survive disconnections using tmux
- 👑 **Admin Panel** - User management, settings, and monitoring
- 📧 **Email Activation** - Secure account activation via email
- 🎨 **Modern UI** - Clean, dark-themed interface with xterm.js

## Prerequisites

- Node.js 18+ 
- tmux
- irssi
- A Linux/Unix server (tested on Ubuntu 24)

## Quick Start

### 1. Install System Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install tmux irssi build-essential python3

# CentOS/RHEL
sudo yum install tmux irssi gcc-c++ make python3
```

### 2. Clone and Install

```bash
git clone <your-repo-url> web-irssi
cd web-irssi
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit `.env` with your settings:

```env
PORT=3001
BASE_URL=http://your-domain.com:3001
IRC_SERVER=irc.libera.chat
IRC_PORT=6667

# Optional: Email for user activation
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001`

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server/index.js --name web-irssi

# Enable startup on boot
pm2 startup
pm2 save

# Monitor logs
pm2 logs web-irssi

# Restart
pm2 restart web-irssi
```

### Using systemd

Create `/etc/systemd/system/web-irssi.service`:

```ini
[Unit]
Description=Web IRSSI
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/web-irssi
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable web-irssi
sudo systemctl start web-irssi
sudo systemctl status web-irssi
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/web-irssi`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /terminal {
        proxy_pass http://localhost:3001/terminal;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/web-irssi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Initial Admin Setup

### Create First Admin User

You can create the first admin user via the database directly:

```bash
# Access the SQLite database
sqlite3 users.db

# Create admin user (replace values)
INSERT INTO users (username, email, password_hash, created_at, is_admin, is_activated)
VALUES ('admin', 'admin@example.com', NULL, strftime('%s','now')*1000, 1, 0);

# Get the activation token
SELECT activation_token FROM users WHERE username = 'admin';
```

Visit: `http://your-domain.com/activate?token=<activation_token>`

Or use the API to create users programmatically.

## Project Structure

```
web-irssi/
├── server/
│   ├── index.js              # Main entry point
│   ├── config.js             # Configuration
│   ├── database/
│   │   ├── db.js             # Database connection
│   │   ├── schema.js         # Database schema
│   │   └── queries.js        # Prepared statements
│   ├── middleware/
│   │   ├── auth.js           # Authentication
│   │   └── errorHandler.js  # Error handling
│   ├── routes/
│   │   ├── auth.routes.js    # Auth endpoints
│   │   ├── admin.routes.js   # Admin endpoints
│   │   └── terminal.routes.js # WebSocket
│   ├── services/
│   │   ├── user.service.js   # User management
│   │   ├── email.service.js  # Email sending
│   │   └── terminal.service.js # Terminal/PTY
│   └── utils/
│       ├── crypto.js         # Password hashing
│       └── logger.js         # Logging
├── public/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js           # Main app
│       ├── api.js           # API client
│       ├── terminal.js      # Terminal manager
│       ├── auth.js          # Auth UI
│       └── admin.js         # Admin panel
├── irssi-sessions/          # User sessions (auto-created)
├── users.db                 # SQLite database (auto-created)
├── package.json
└── .env
```

## API Endpoints

### Authentication

- `POST /api/auth` - Login
- `POST /api/logout` - Logout
- `POST /api/activate` - Activate account
- `GET /api/activate/:token` - Get activation info

### Admin (requires admin role)

- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/reset-password` - Reset password
- `GET /api/admin/settings` - Get settings
- `POST /api/admin/settings` - Update settings
- `POST /api/admin/clear-session` - Clear user session

### WebSocket

- `WS /terminal?token=<jwt>` - Terminal connection

## Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT token-based sessions (7-day expiry)
- ✅ SQL injection prevention (prepared statements)
- ✅ XSS protection (input sanitization)
- ✅ CSRF protection (SameSite cookies)
- ✅ Session cleanup on logout
- ✅ User directory isolation
- ✅ WebSocket authentication
- ✅ Blocked IRC /quit and /exit commands

## Customization

### Changing IRC Server

Edit `.env`:

```env
IRC_SERVER=irc.your-server.com
IRC_PORT=6697  # Use 6697 for SSL
```

### Adjusting User Limits

Access admin panel → Settings → Maximum Users

Or via database:

```sql
UPDATE settings SET value = '50' WHERE key = 'max_users';
```

### Custom Themes

Edit `public/css/styles.css` CSS variables:

```css
:root {
    --bg-primary: #000;
    --accent: #0a84ff;
    /* ... */
}
```

## Troubleshooting

### Terminal Not Connecting

1. Check WebSocket is working:
   ```bash
   pm2 logs web-irssi
   ```

2. Verify tmux is installed:
   ```bash
   which tmux
   ```

3. Check user session directory:
   ```bash
   ls -la irssi-sessions/
   ```

### Email Not Sending

1. Check email credentials in `.env`
2. For Gmail, use App Password (not regular password)
3. Check logs: `pm2 logs web-irssi`
4. Activation links will be logged if email fails

### Database Locked

```bash
# Stop the server
pm2 stop web-irssi

# Remove lock files
rm users.db-shm users.db-wal

# Restart
pm2 start web-irssi
```

### Port Already in Use

```bash
# Find process using port 3001
sudo lsof -i :3001

# Kill it
sudo kill -9 <PID>

# Or change port in .env
PORT=3002
```

## Maintenance

### Backup Database

```bash
# Create backup
cp users.db users.db.backup.$(date +%Y%m%d)

# Or with sqlite3
sqlite3 users.db ".backup users.db.backup"
```

### Clean Old Sessions

```bash
# Remove all user sessions (users must reconnect)
rm -rf irssi-sessions/*
```

### Update Dependencies

```bash
npm update
npm audit fix
```

## Performance Tuning

### For High User Counts

Edit `server/config.js`:

```javascript
session: {
    tokenExpiry: 7 * 24 * 60 * 60 * 1000, // Reduce to 1 day
    activationExpiry: 12 * 60 * 60 * 1000 // 12 hours
}
```

### Database Optimization

```sql
-- In users.db
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
```

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: <your-repo>/issues
- Documentation: <your-docs-url>

## Contributing

Pull requests welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Credits

- Built with [xterm.js](https://xtermjs.org/)
- Uses [node-pty](https://github.com/microsoft/node-pty)
- Powered by [Express.js](https://expressjs.com/)
