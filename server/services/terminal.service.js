// server/services/terminal.service.js (Docker-compatible)

import pty from 'node-pty';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

class TerminalService {
    constructor() {
        this.activeSessions = new Map();
        this.ensureBaseDirectory();
    }

    ensureBaseDirectory() {
        if (!fs.existsSync(config.paths.sessions)) {
            fs.mkdirSync(config.paths.sessions, { recursive: true });
        }
    }

    ensureUserDirectory(username) {
        const userDir = path.join(config.paths.sessions, username);
        if (!fs.existsSync(userDir)) {
            console.log(`Creating directory for user: ${username}`);
            fs.mkdirSync(userDir, { recursive: true });
        }
        return userDir;
    }

// server/services/terminal.service.js - createStartupScript method

createStartupScript(userDir, username) {
    const startupScript = path.join(userDir, 'startup.sh');
    const tmuxConf = path.join(userDir, '.tmux.conf');
    const tmuxSocket = path.join(userDir, '.tmux-socket');
    const irssiConfig = path.join(userDir, 'config');
    const logFile = path.join(userDir, 'session.log');

    // Ensure directory exists
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
    }

    // Create tmux config
    fs.writeFileSync(tmuxConf, `
set -g default-terminal "screen-256color"
set -g history-limit 50000
set -g aggressive-resize on
set -g focus-events on
    `.trim());

    console.log(`Created tmux config: ${tmuxConf}`);

    // Create irssi config with UTF-8 support
    fs.writeFileSync(irssiConfig, `
settings = {
  core = {
    real_name = "${username}";
    user_name = "${username}";
    nick = "${username}";
  };
  "fe-text" = { 
    term_charset = "UTF-8";
  };
  "fe-common/core" = {
    term_charset = "UTF-8";
    autolog = "no";
  };
};
    `.trim());

    console.log(`Created irssi config: ${irssiConfig}`);

    // Create startup script
    fs.writeFileSync(startupScript, `#!/bin/bash

# Force UTF-8 everywhere
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export LANGUAGE=en_US:en
export TERM=xterm-256color

# Paths
TMUX_SESSION="${username}-irssi"
TMUX_CONF="${tmuxConf}"
TMUX_SOCKET="${tmuxSocket}"
TMUX_BIN="/usr/bin/tmux"
IRSSI_BIN="/usr/bin/irssi"
LOG_FILE="${logFile}"

log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_msg "Starting session with UTF-8: LANG=$LANG"

# Check for existing session
if $TMUX_BIN -S "$TMUX_SOCKET" -f "$TMUX_CONF" has-session -t "$TMUX_SESSION" 2>/dev/null; then
    log_msg "Attaching to existing session"
    exec $TMUX_BIN -u -S "$TMUX_SOCKET" -f "$TMUX_CONF" attach-session -t "$TMUX_SESSION"
else
    log_msg "Creating new session"
    exec $TMUX_BIN -u -S "$TMUX_SOCKET" -f "$TMUX_CONF" new-session -s "$TMUX_SESSION" \\
        "export LANG=en_US.UTF-8; \\
         export LC_ALL=en_US.UTF-8; \\
         export LC_CTYPE=en_US.UTF-8; \\
         while true; do \\
            $IRSSI_BIN --home='${userDir}' --nick='${username}' \\
                --connect='${config.irc.server}:${config.irc.port}'; \\
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
            console.log(`Creating new PTY session for: ${username}`);

            // Ensure user directory exists
            const userDir = this.ensureUserDirectory(username);

            // Create startup script
            const startupScript = this.createStartupScript(userDir, username);

            // Verify files were created
            if (!fs.existsSync(startupScript)) {
                throw new Error(`Failed to create startup script for ${username}`);
            }

            console.log(`Spawning PTY for ${username} with script: ${startupScript}`);

            const ptyProcess = pty.spawn('/bin/bash', [startupScript], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: userDir,
                env: {
                    PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin',
                    TERM: 'xterm-256color',
                    HOME: userDir,
                    USER: username,
                    SHELL: '/bin/bash'
                }
            });

            session = {
                pty: ptyProcess,
                connections: new Set(),
                username,
                dataHandler: null
            };

            // Create the data handler ONCE and store it
            session.dataHandler = (data) => {
                session.connections.forEach(clientWs => {
                    if (clientWs.readyState === 1) {
                        try {
                            clientWs.send(JSON.stringify({ type: 'output', data }));
                        } catch (e) {
                            console.error('Error sending data:', e);
                        }
                    }
                });
            };

            // Register the handler ONCE
            ptyProcess.onData(session.dataHandler);

            ptyProcess.onExit((exitCode) => {
                console.log(`PTY process exited for ${username} with code ${exitCode}`);
                this.activeSessions.delete(username);
                session.connections.forEach(ws => ws.close());
            });

            this.activeSessions.set(username, session);

            console.log(`PTY session created for ${username}`);
        }

        return session;
    }

    handleConnection(ws, username) {
        try {
            const session = this.getOrCreateSession(username);

            // Add this connection to the set
            session.connections.add(ws);

            console.log(`Connection added for ${username}. Total connections: ${session.connections.size}`);

            // Send refresh to new connection only
            setTimeout(() => {
                if (ws.readyState === 1) {
                    session.pty.write('\x0c'); // Ctrl+L to refresh
                    session.pty.resize(80, 24);
                }
            }, 100);

            // Handle connection close
            ws.on('close', () => {
                session.connections.delete(ws);
                console.log(`Connection removed for ${username}. Remaining: ${session.connections.size}`);
            });

            return session;
        } catch (error) {
            console.error(`Error handling connection for ${username}:`, error);
            ws.close();
            throw error;
        }
    }

    killSession(username) {
        const session = this.activeSessions.get(username);
        if (session) {
            console.log(`Killing session for ${username}`);
            session.pty.kill();
            this.activeSessions.delete(username);
        }
    }
}

export default new TerminalService();
