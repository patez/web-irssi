import { UserService } from '../services/user.service.js';

export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const user = UserService.getUserFromToken(token);

    if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
}

export function requireAdmin(req, res, next) {
    if (!req.user || req.user.is_admin !== 1) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
