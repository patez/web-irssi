import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
    port: process.env.PORT || 3001,
    baseUrl: process.env.BASE_URL || 'http://localhost:3001',
    adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
    
    irc: {
        server: process.env.IRC_SERVER || 'irc.libera.chat',
        port: process.env.IRC_PORT || 6667
    },
    
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER
    },
    
    paths: {
        root: dirname(__dirname),
        sessions: join(dirname(__dirname), 'irssi-sessions'),
        database: join(dirname(__dirname), 'users.db'),
        public: join(dirname(__dirname), 'public')
    },
    
    session: {
        tokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
        activationExpiry: 24 * 60 * 60 * 1000 // 24 hours
    }
};
