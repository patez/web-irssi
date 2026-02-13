import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

class TerminalService {
    constructor() {
        this.activeSessions = new Map();
    }

createStartupScript(userDir, username) {
    const startupScript = path.join(userDir, 'startup.sh');
    const tmuxConf = path.join(userDir, '.tmux.conf');
    const tmuxSocket = path.join(userDir, '.tmux-socket');

    // Create tmux config
    fs.writeFileSync(tmuxConf, `
set -g aggressive-resize on
set -g history-limit 50000
set -g focus-events on
set -g default-terminal "screen-256color"
    `.trim());

    console.log(`Created tmux config: ${tmuxConf}`);

    // Create startup script with absolute paths
    fs.writeFileSync(startupScript, `#!/bin/bash

# Set environment explicitly
export PATH=/usr/local/bin:/usr/bin:/bin
export HOME="${userDir}"
export USER="${username}"
export TERM="xterm-256color"

# Trap signals
trap '' SIGINT SIGTERM SIGQUIT

# Configuration
TMUX_SESSION="${username}-irssi"
TMUX_CONF="${tmuxConf}"
TMUX_SOCKET="${tmuxSocket}"
TMUX_BIN="/usr/bin/tmux"
IRSSI_BIN="/usr/bin/irssi"

# Log for debugging
echo "[$(date)] Starting session for ${username}" >> "${userDir}/session.log"

# Check if tmux exists
if [ ! -x "$TMUX_BIN" ]; then
    echo "[$(date)] ERROR: tmux not found at $TMUX_BIN" >> "${userDir}/session.log"
    exit 1
fi

# Check if irssi exists
if [ ! -x "$IRSSI_BIN" ]; then
    echo "[$(date)] ERROR: irssi not found at $IRSSI_BIN" >> "${userDir}/session.log"
    exit 1
fi

# Check for existing session
if $TMUX_BIN -S "$TMUX_SOCKET" -f "$TMUX_CONF" has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo "[$(date)] Attaching to existing session" >> "${userDir}/session.log"
    $TMUX_BIN -S "$TMUX_SOCKET" -f "$TMUX_CONF" attach-session -t "$TMUX_SESSION"
else
    echo "[$(date)] Creating new session" >> "${userDir}/session.log"
    $TMUX_BIN -S "$TMUX_SOCKET" -f "$TMUX_CONF" new-session -s "$TMUX_SESSION" \\
        "while true; do \\
            $IRSSI_BIN --home='${userDir}' --nick='${username}' \\
                --connect='${config.irc.server}:${config.irc.port}'; \\
            echo 'irssi exited. Restarting in 2 seconds...'; \\
            sleep 2; \\
        done"
fi
    `, { mode: 0o755 });

    console.log(`Created startup script: ${startupScript}`);

    return startupScript;
}
    getOrCreateSession(username) {
        let session = this.activeSessions.get(username);

        if (!session) {
            const userDir = path.join(config.paths.sessions, username);
            const startupScript = this.createStartupScript(userDir, username);

            const ptyProcess = pty.spawn('bash', [startupScript], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: userDir,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    HOME: userDir,
                    USER: username
                }
            });

            session = {
                pty: ptyProcess,
                connections: new Set(),
                username
            };

	    // This only runs ONCE when the pty starts
            ptyProcess.onData((data) => {
              session.connections.forEach(clientWs => {
                if (clientWs.readyState === 1) { // 1 = OPEN
                    try {
                        clientWs.send(JSON.stringify({ type: 'output', data }));
                    } catch (e) {
                        console.error('Send error:', e);
                    }
                }
              });
             });

            ptyProcess.onExit(() => {
                this.activeSessions.delete(username);
                session.connections.forEach(ws => ws.close());
            });

            this.activeSessions.set(username, session);
        }

        return session;
    }

    handleConnection(ws, username) {
        const session = this.getOrCreateSession(username);
        session.connections.add(ws);

        // Send existing output to new connection
        setTimeout(() => {
            session.pty.write('\x0c'); // Ctrl+L to refresh
            session.pty.resize(80, 24);
        }, 100);



        ws.on('close', () => {
            session.connections.delete(ws);
        });

        return session;
    }

    killSession(username) {
        const session = this.activeSessions.get(username);
        if (session) {
            session.pty.kill();
            this.activeSessions.delete(username);
        }
    }
}

export default new TerminalService();
