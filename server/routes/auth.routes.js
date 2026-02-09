import express from 'express';
import { UserService } from '../services/user.service.js';
import { authenticate } from '../middleware/auth.js';
import { userQueries } from '../database/queries.js';

const router = express.Router();

router.post('/auth', (req, res, next) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = UserService.authenticate(username, password);
        const token = UserService.createSession(user.id, req.ip);

        res.json({ token, username: user.username, isAdmin: user.isAdmin });
    } catch (error) {
        next(error);
    }
});

router.post('/logout', authenticate, (req, res, next) => {
    try {
        const token = req.headers.authorization.substring(7);
        UserService.deleteSession(token);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

router.post('/activate', (req, res, next) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ error: 'Token and password required' });
        }

        const result = UserService.activateUser(token, password);
        res.json({ success: true, username: result.username });
    } catch (error) {
        next(error);
    }
});

router.get('/activate/:token', (req, res, next) => {
    try {
        const { token } = req.params;
        const user = userQueries.findByActivationToken.get(token);
        
        if (!user) {
            return res.status(404).json({ error: 'Invalid activation token' });
        }
        
        res.json({
	    token, 
            username: user.username,
            email: user.email 
        });
    } catch (error) {
        next(error);
    }
});

export default router;
