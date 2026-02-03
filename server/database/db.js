import Database from 'better-sqlite3';
import config from '../config.js';
import { initSchema } from './schema.js';

class DatabaseManager {
    constructor() {
        this.db = new Database(config.paths.database);
        this.db.pragma('journal_mode = WAL');
        initSchema(this.db);
        this.cleanupExpiredSessions();
    }

    cleanupExpiredSessions() {
        this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    }

    getSetting(key, defaultValue) {
        const result = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return result ? result.value : defaultValue;
    }

    setSetting(key, value) {
        this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
            .run(key, value.toString());
    }

    close() {
        this.db.close();
    }
}

export default new DatabaseManager();
