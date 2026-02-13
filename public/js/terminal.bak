const TerminalManager = {
    term: null,
    fitAddon: null,
    ws: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 50,
    resizeObserver: null,

    init() {
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

        // Use modern FitAddon from @xterm/addon-fit
        this.fitAddon = new FitAddon.FitAddon();
        this.term.loadAddon(this.fitAddon);
        this.term.open(document.getElementById('terminal'));
        this.fit();

        // Handle input
        this.term.onData(data => this.handleInput(data));

        // Use ResizeObserver for better resize detection
        this.setupResizeObserver();

        // Fallback to window resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.fit(), 100);
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.fit(), 300);
        });

        // Handle visibility changes for better mobile support
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.fit(), 100);
            }
        });
    },

    setupResizeObserver() {
        // Use modern ResizeObserver API if available
        if (typeof ResizeObserver !== 'undefined') {
            const container = document.getElementById('terminal-container');
            this.resizeObserver = new ResizeObserver(() => {
                this.fit();
            });
            this.resizeObserver.observe(container);
        }
    },

    fit() {
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'resize',
                cols: this.term.cols,
                rows: this.term.rows
            }));
        }
    },

    connect(token) {

	//  Prevent the "Double Connect" race condition
    	if (this.isConnecting) return;
	// 1. Force-kill any "ghost" connection before even thinking about a new one
    	if (this.ws) {
        	console.log('Force-killing ghost connection...');
        	// Detach all listeners explicitly
        	this.ws.onopen = null;
        	this.ws.onmessage = null;
        	this.ws.onclose = null;
        	this.ws.onerror = null;
        
        if (this.ws.readyState !== WebSocket.CLOSED) {
            this.ws.close();
        }
        this.ws = null;
    }

    this.isConnecting = true;
    	

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${protocol}//${window.location.host}/terminal?token=${token}`;

        this.ws = new WebSocket(wsURL);

        this.ws.onopen = () => {
            app.updateStatus('connected', 'Connected');
	    this.isConnecting = false;
            this.reconnectAttempts = 0;
            setTimeout(() => {
                this.sendResize();
		this.ws.send(JSON.stringify({ type: 'input', data: '\x0c' }));
                setTimeout(() => this.sendResize(), 100);
                setTimeout(() => this.sendResize(), 300);
            }, 50);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'output') {
                    this.term.write(data.data);
                }
            } catch {
                this.term.write(event.data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            app.updateStatus('disconnected', 'Connection closed');
            if (!app.manualDisconnect) {
                this.attemptReconnect();
            }
        };
    },

    attemptReconnect() {
        if (!app.authToken || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts - 1), 30000);

        app.updateStatus('connecting', `Reconnecting in ${Math.round(delay/1000)}s`);

        this.reconnectTimer = setTimeout(() => {
            this.term.writeln(`\r\n\x1b[1;33m[*] Reconnecting...\x1b[0m\r\n`);
            this.connect(app.authToken);
        }, delay);
    },

    handleInput(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    },

    forceRefresh() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'input',
            data: '\x0c'
        }));

        setTimeout(() => {
            this.sendResize();
            setTimeout(() => this.sendResize(), 100);
        }, 50);
    },

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.term.clear();
        // 4. Dispose of the terminal to kill keyboard listeners
    	if (this.term) {
        console.log('Disposing xterm instance...');
        this.term.dispose(); // This kills the listeners
        this.term = null;
    	}

    	// 5. Reset flags so the app knows it needs a fresh init
    	this.initialized = false;
    	this.isConnecting = false;
    },

    dispose() {
        this.disconnect();
        if (this.term) {
            this.term.dispose();
        }
    }
};
