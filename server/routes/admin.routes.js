import express from 'express';
import { UserService } from '../services/user.service.js';
import emailService from '../services/email.service.js';
import terminalService from '../services/terminal.service.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import db from '../database/db.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/users', (req, res, next) => {
    try {
        const users = UserService.listUsers();
        res.json({ users });
    } catch (error) {
        next(error);
    }
});

router.post('/users', async (req, res, next) => {
    try {
        const { username, email, isAdmin } = req.body;
        
        const user = UserService.createUser(username, email, isAdmin);
        const emailResult = await emailService.sendActivation(
            user.email,
            user.username,
            user.activationToken
        );

        res.json({
            success: true,
            message: 'User created',
            activationLink: emailResult.link
        });
    } catch (error) {
        next(error);
    }
});

router.delete('/users/:userId', (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const user = UserService.listUsers().find(u => u.id === userId);
        if (user) {
            terminalService.killSession(user.username);
        }

        UserService.deleteUser(userId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/users/:userId/reset-password', (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        const { newPassword } = req.body;

        UserService.resetPassword(userId, newPassword);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.get('/settings', (req, res, next) => {
    try {
        res.json({
            maxUsers: parseInt(db.getSetting('max_users', '10')),
            currentUsers: UserService.listUsers().length,
            activeSessions: terminalService.activeSessions.size
        });
    } catch (error) {
        next(error);
    }
});

router.post('/settings', (req, res, next) => {
    try {
        const { maxUsers } = req.body;
        
        if (maxUsers !== undefined) {
            const max = parseInt(maxUsers);
            if (isNaN(max) || max < 1 || max > 1000) {
                return res.status(400).json({ error: 'Max users must be between 1 and 1000' });
            }
            db.setSetting('max_users', max);
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/clear-session', (req, res, next) => {
    try {
        const userDir = path.join(config.paths.sessions, req.user.username);
        
        terminalService.killSession(req.user.username);
        
        if (fs.existsSync(userDir)) {
            fs.rmSync(userDir, { recursive: true, force: true });
            fs.mkdirSync(userDir, { recursive: true });
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export default router;
