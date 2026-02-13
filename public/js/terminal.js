// public/js/terminal.js

const TerminalManager = {
    term: null,
    fitAddon: null,
    ws: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    resizeObserver: null,
    isConnecting: false,
    isInitialized: false,

    init() {
        if (this.isInitialized) {
            console.log('Terminal already initialized');
            return;
        }

        console.log('Initializing terminal...');

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        this.term = new Terminal({
            cursorBlink: true,
            fontSize: isMobile ? 12 : 14,
            fontFamily: 'Menlo, Monaco, "Courier New", Consolas, monospace',
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selection: 'rgba(255, 255, 255, 0.3)',
                selectionInactiveBackground: 'rgba(255, 255, 255, 0.15)'
            },
            scrollback: 10000,
            fastScrollModifier: 'shift',
            convertEol: true,
            allowProposedApi: false
        });

        this.fitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.fitAddon);

        const terminalElement = document.getElementById('terminal');
        if (!terminalElement) {
            console.error('Terminal element not found!');
            return;
        }

        this.term.open(terminalElement);
        this.fit();
        this.isInitialized = true;

        // Handle input
        this.term.onData(data => this.handleInput(data));

        // Setup resize handling
        this.setupResizeHandling();

        console.log('Terminal initialized successfully');
    },

    setupResizeHandling() {
        // Use ResizeObserver for better resize detection
        if (typeof ResizeObserver !== 'undefined') {
            const container = document.getElementById('terminal-container');
            if (container) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.fit();
                });
                this.resizeObserver.observe(container);
            }
        }

        // Fallback to window resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.fit(), 100);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.fit(), 300);
        });

        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.fit(), 100);
            }
        });
    },

    fit() {
        if (!this.isInitialized || !this.fitAddon) {
            return;
        }

        try {
            this.fitAddon.fit();
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendResize();
            }
        } catch (e) {
            console.error('Fit error:', e);
        }
    },

    sendResize() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            this.ws.send(JSON.stringify({
                type: 'resize',
                cols: this.term.cols,
                rows: this.term.rows
            }));
        } catch (e) {
            console.error('Failed to send resize:', e);
        }
    },

    connect(token) {
        console.log('connect() called, state:', {
            isConnecting: this.isConnecting,
            hasWs: !!this.ws,
            wsState: this.ws?.readyState
        });

        // CRITICAL: Prevent multiple simultaneous connection attempts
        if (this.isConnecting) {
            console.log('Connection already in progress, ignoring');
            return;
        }

        // Clear any pending reconnect timers
        if (this.reconnectTimer) {
            console.log('Clearing existing reconnect timer');
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Close existing connection cleanly
        this.closeExistingConnection();

        // Mark as connecting
        this.isConnecting = true;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}/terminal?token=${token}`;

        console.log('Creating new WebSocket connection...');
        this.ws = new WebSocket(wsURL);

        // Connection opened
        this.ws.onopen = () => {
            console.log('WebSocket connected successfully');
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            app.updateStatus('connected', 'Connected');

            // Send initial resize
            setTimeout(() => {
                this.sendResize();
                setTimeout(() => this.sendResize(), 100);
                setTimeout(() => this.sendResize(), 300);
            }, 50);
        };

        // Receive data
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'output') {
                    this.term.write(data.data);
                }
            } catch {
                // If not JSON, write as-is
                this.term.write(event.data);
            }
        };

        // Error occurred
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnecting = false;
        };

        // Connection closed
        this.ws.onclose = (event) => {
            console.log('WebSocket closed:', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
            });

            this.isConnecting = false;
            app.updateStatus('disconnected', 'Connection closed');

            // Only attempt reconnect if:
            // 1. Not a manual disconnect
            // 2. Not at max attempts
            // 3. Have a valid token
            if (!app.manualDisconnect &&
                this.reconnectAttempts < this.maxReconnectAttempts &&
                app.authToken) {
                this.attemptReconnect();
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.log('Max reconnect attempts reached');
                app.updateStatus('disconnected', 'Max reconnects reached. Click Reconnect to try again.');
            }
        };
    },

    closeExistingConnection() {
        if (!this.ws) {
            return;
        }

        console.log('Closing existing WebSocket (state:', this.ws.readyState, ')');

        try {
            // Remove event handlers to prevent reconnect loop
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;

            // Close the connection
            if (this.ws.readyState === WebSocket.OPEN ||
                this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
        } catch (e) {
            console.error('Error closing WebSocket:', e);
        }

        this.ws = null;
    },

    attemptReconnect() {
        // CRITICAL: Only one reconnect timer at a time
        if (this.reconnectTimer) {
            console.log('Reconnect already scheduled, skipping');
            return;
        }

        this.reconnectAttempts++;

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);

        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
        app.updateStatus('connecting', `Reconnecting in ${Math.round(delay / 1000)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;

            if (app.authToken && !app.manualDisconnect) {
                console.log('Executing reconnect attempt', this.reconnectAttempts);
                this.term.writeln(`\r\n\x1b[1;33m[*] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...\x1b[0m\r\n`);
                this.connect(app.authToken);
            } else {
                console.log('Reconnect cancelled (no token or manual disconnect)');
            }
        }, delay);
    },

    handleInput(data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('Cannot send input: WebSocket not open');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'input',
            data: data
        }));
    },

    forceRefresh() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('Cannot refresh: WebSocket not open');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'input',
            data: '\x0c' // Ctrl+L
        }));

        setTimeout(() => {
            this.sendResize();
            setTimeout(() => this.sendResize(), 100);
        }, 50);
    },

    disconnect() {
        console.log('disconnect() called');

        // Clear reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        // Reset reconnect attempts
        this.reconnectAttempts = 0;

        // Close WebSocket
        this.closeExistingConnection();

        // Clear terminal
        if (this.term) {
            this.term.clear();
        }
    },

    dispose() {
        console.log('dispose() called');

        this.disconnect();

        // Disconnect resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Dispose terminal
        if (this.term) {
            try {
                this.term.dispose();
            } catch (e) {
                console.error('Error disposing terminal:', e);
            }
            this.term = null;
        }

        this.isInitialized = false;
    }
};