import express from 'express';
import expressWs from 'express-ws';
import config from './config.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { setupWebSocket } from './routes/terminal.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import db from './database/db.js';

const app = express();
expressWs(app);

// Middleware
app.use(express.json());
app.use(express.static(config.paths.public));

// Routes
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);

// Activation redirect
app.get('/activate', (req, res) => {
    const token = req.query.token;
    if (!token) {
        return res.status(400).send('Missing activation token');
    }
    res.redirect(`/?token=${token}`);
});

// WebSocket
setupWebSocket(app);

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    db.close();
    process.exit(0);
});

// Start server
app.listen(config.port, () => {
    logger.success(`Server running on ${config.baseUrl}`);
    logger.info(`Admin panel available at ${config.baseUrl}/admin`);
});
