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

    createStartupScript(userDir, username) {
        // Ensure user directory exists first
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const startupScript = path.join(userDir, 'startup.sh');
        const tmuxConf = path.join(userDir, '.tmux.conf');
        const tmuxSocket = path.join(userDir, '.tmux-socket');
        const logFile = path.join(userDir, 'session.log');

        // Create tmux config
        fs.writeFileSync(tmuxConf, `
set -g aggressive-resize on
set -g history-limit 50000
set -g focus-events on
set -g default-terminal "screen-256color"
        `.trim());

        console.log(`Created tmux config: ${tmuxConf}`);

        // Create startup script with ABSOLUTE PATHS (critical for Docker)
        fs.writeFileSync(startupScript, `#!/bin/bash

# Explicit PATH for Docker environment
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin
export HOME="${userDir}"
export USER="${username}"
export TERM="xterm-256color"
export SHELL="/bin/bash"

# Trap signals
trap '' SIGINT SIGTERM SIGQUIT

# Configuration with absolute paths
TMUX_SESSION="${username}-irssi"
TMUX_CONF="${tmuxConf}"
TMUX_SOCKET="${tmuxSocket}"
TMUX_BIN="/usr/bin/tmux"
IRSSI_BIN="/usr/bin/irssi"
LOG_FILE="${logFile}"

# Logging function
log_msg() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_msg "Starting session for ${username}"
log_msg "PATH: $PATH"
log_msg "TMUX_BIN: $TMUX_BIN"
log_msg "IRSSI_BIN: $IRSSI_BIN"

# Verify binaries exist
if [ ! -x "$TMUX_BIN" ]; then
    log_msg "ERROR: tmux not found at $TMUX_BIN"
    # Try alternative locations
    if [ -x "/usr/local/bin/tmux" ]; then
        TMUX_BIN="/usr/local/bin/tmux"
        log_msg "Found tmux at $TMUX_BIN"
    else
        echo "ERROR: tmux not found" >&2
        exit 1
    fi
fi

if [ ! -x "$IRSSI_BIN" ]; then
    log_msg "ERROR: irssi not found at $IRSSI_BIN"
    # Try alternative locations
    if [ -x "/usr/local/bin/irssi" ]; then
        IRSSI_BIN="/usr/local/bin/irssi"
        log_msg "Found irssi at $IRSSI_BIN"
    else
        echo "ERROR: irssi not found" >&2
        exit 1
    fi
fi

log_msg "Binaries verified - tmux: $TMUX_BIN, irssi: $IRSSI_BIN"

# 1. Check for existing session
if $TMUX_BIN -S "$TMUX_SOCKET" has-session -t "$TMUX_SESSION" 2>/dev/null; then
    log_msg "Attaching to existing session: $TMUX_SESSION"
    exec $TMUX_BIN -S "$TMUX_SOCKET" attach-session -t "$TMUX_SESSION"
else
    log_msg "Creating new detached session: $TMUX_SESSION"

    # 2. Create the session DETACHED (-d) first. 
    # We pass 'bash' as the command so we have a reliable shell environment.
    $TMUX_BIN -S "$TMUX_SOCKET" -f "$TMUX_CONF" new-session -d -s "$TMUX_SESSION" -c "$userDir" /bin/bash

    # 3. Send the complex loop as a literal string to the session.
    # This avoids the nested quoting issues in the 'new-session' line.
    $TMUX_BIN -S "$TMUX_SOCKET" send-keys -t "$TMUX_SESSION" "
        log_msg() { echo \"[\$(date '+%Y-%m-%d %H:%M:%S')] \$1\" >> \"$logFile\"; };
        while true; do
            log_msg 'Starting irssi';
            $IRSSI_BIN --home='$userDir' --nick='$username';
            EXIT_CODE=\$?;
            log_msg \"irssi exited with code \$EXIT_CODE\";
            echo 'irssi exited. Restarting in 2 seconds...';
            sleep 2;
        done
    " C-m

    # 4. Now attach to the session we just prepared.
    log_msg "Setup complete. Attaching..."
    exec $TMUX_BIN -S "$TMUX_SOCKET" attach-session -t "$TMUX_SESSION"
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