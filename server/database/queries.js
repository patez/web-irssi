import db from './db.js';

export const userQueries = {
    findByUsername: db.db.prepare('SELECT * FROM users WHERE username = ?'),
    findById: db.db.prepare('SELECT * FROM users WHERE id = ?'),
    findByActivationToken: db.db.prepare(
        'SELECT * FROM users WHERE activation_token = ? AND is_activated = 0'
    ),
    create: db.db.prepare(`
        INSERT INTO users (username, email, password_hash, created_at, is_admin, is_activated, activation_token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    updatePassword: db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    activate: db.db.prepare(
        'UPDATE users SET password_hash = ?, is_activated = 1, activation_token = NULL WHERE id = ?'
    ),
    updateLastLogin: db.db.prepare('UPDATE users SET last_login = ? WHERE id = ?'),
    delete: db.db.prepare('DELETE FROM users WHERE id = ?'),
    list: db.db.prepare(`
        SELECT id, username, email, created_at, last_login, is_admin, is_activated
        FROM users ORDER BY created_at DESC
    `),
    count: db.db.prepare('SELECT COUNT(*) as count FROM users')
};

export const sessionQueries = {
    create: db.db.prepare(`
        INSERT INTO sessions (user_id, token, created_at, expires_at, ip_address)
        VALUES (?, ?, ?, ?, ?)
    `),
    findByToken: db.db.prepare(`
        SELECT users.* FROM users
        JOIN sessions ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > ?
    `),
    deleteByToken: db.db.prepare('DELETE FROM sessions WHERE token = ?'),
    deleteByUserId: db.db.prepare('DELETE FROM sessions WHERE user_id = ?')
};
