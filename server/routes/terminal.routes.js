import { UserService } from '../services/user.service.js';
import terminalService from '../services/terminal.service.js';
import { logger } from '../utils/logger.js';

export function setupWebSocket(app) {
    app.ws('/terminal', (ws, req) => {
        const token = req.query.token;
        const user = UserService.getUserFromToken(token);

        if (!user) {
            ws.close(1008, 'Unauthorized');
            return;
        }

        logger.info(`Terminal connected: ${user.username}`);

        const session = terminalService.handleConnection(ws, user.username);

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);

                if (data.type === 'input') {
                    const input = data.data.toString();

                    if (input.includes('/quit') || input.includes('/exit')) {
                        ws.send(JSON.stringify({
                            type: 'output',
                            data: '\r\n\x1b[1;31m[BLOCKED] /quit and /exit are disabled.\x1b[0m\r\n'
                        }));
                        return;
                    }

                    session.pty.write(data.data);
                } else if (data.type === 'resize') {
                    session.pty.resize(data.cols, data.rows);
                    setTimeout(() => {
                        try {
                            session.pty.write('\x0c');
                        } catch (e) {}
                    }, 50);
                }
            } catch (e) {
                logger.error(`WebSocket message error: ${e.message}`);
            }
        });

        ws.on('close', () => {
            logger.info(`Terminal disconnected: ${user.username}`);
        });
    });
}
