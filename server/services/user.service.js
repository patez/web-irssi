import { userQueries, sessionQueries } from '../database/queries.js';
import { hashPassword, verifyPassword, generateToken } from '../utils/crypto.js';
import config from '../config.js';
import db from '../database/db.js';
import fs from 'fs';
import path from 'path';

export class UserService {
    static validateUsername(username) {
        const sanitized = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (sanitized !== username.toLowerCase().trim()) {
            throw new Error('Username can only contain letters, numbers, - and _');
        }
        if (sanitized.length < 3 || sanitized.length > 20) {
            throw new Error('Username must be 3-20 characters');
        }
        return sanitized;
    }

    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email address');
        }
        return email;
    }

    static createUserDirectory(username) {
        const userDir = path.join(config.paths.sessions, username);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        return userDir;
    }

    static createUser(username, email, isAdmin = false) {
        const sanitizedUsername = this.validateUsername(username);
        const sanitizedEmail = this.validateEmail(email);
        
        const maxUsers = parseInt(db.getSetting('max_users', '10'));
        const currentCount = userQueries.count.get().count;
        
        if (currentCount >= maxUsers) {
            throw new Error('User limit reached');
        }

        const existing = userQueries.findByUsername.get(sanitizedUsername);
        if (existing) {
            throw new Error('Username already exists');
        }

        const activationToken = generateToken();
        const result = userQueries.create.run(
            sanitizedUsername,
            sanitizedEmail,
            null, // password_hash set during activation
            Date.now(),
            isAdmin ? 1 : 0,
            0, // not activated
            activationToken
        );

        this.createUserDirectory(sanitizedUsername);

        return {
            id: result.lastInsertRowid,
            username: sanitizedUsername,
            email: sanitizedEmail,
            activationToken
        };
    }

    static activateUser(token, password) {
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const user = userQueries.findByActivationToken.get(token);
        if (!user) {
            throw new Error('Invalid or expired activation token');
        }

        const tokenAge = Date.now() - user.created_at;
        if (tokenAge > config.session.activationExpiry) {
            throw new Error('Activation token expired');
        }

        const passwordHash = hashPassword(password);
        userQueries.activate.run(passwordHash, user.id);

        return { username: user.username };
    }

    static authenticate(username, password) {
        const user = userQueries.findByUsername.get(username.toLowerCase());
        
        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.is_activated) {
            throw new Error('Account not activated');
        }

        if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
            throw new Error('Invalid credentials');
        }

        userQueries.updateLastLogin.run(Date.now(), user.id);

        return {
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin === 1
        };
    }

    static createSession(userId, ipAddress) {
        const token = generateToken();
        const expiresAt = Date.now() + config.session.tokenExpiry;

        sessionQueries.create.run(userId, token, Date.now(), expiresAt, ipAddress);

        return token;
    }

    static getUserFromToken(token) {
        return sessionQueries.findByToken.get(token, Date.now());
    }

    static deleteSession(token) {
        sessionQueries.deleteByToken.run(token);
    }

    static resetPassword(userId, newPassword) {
        if (newPassword.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const passwordHash = hashPassword(newPassword);
        userQueries.updatePassword.run(passwordHash, userId);
        sessionQueries.deleteByUserId.run(userId);
    }

    static deleteUser(userId) {
        const user = userQueries.findById.get(userId);
        if (!user) {
            throw new Error('User not found');
        }

        sessionQueries.deleteByUserId.run(userId);
        userQueries.delete.run(userId);

        const userDir = path.join(config.paths.sessions, user.username);
        if (fs.existsSync(userDir)) {
            fs.rmSync(userDir, { recursive: true, force: true });
        }
    }

    static listUsers() {
        return userQueries.list.all();
    }
}
