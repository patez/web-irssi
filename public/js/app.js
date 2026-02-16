// public/js/app.js

const app = {
    authToken: null,
    username: null,
    isAdmin: false,
    manualDisconnect: false,
    terminalInitialized: false,

    init() {
	console.log('App initializing...');
        
        // Initialize auth UI first
        AuthUI.init();

        // Check if we have an activation token in URL - this takes priority!
        const urlParams = new URLSearchParams(window.location.search);
        const activationToken = urlParams.get('token');
        
        if (activationToken) {
            console.log('Activation token found in URL, ignoring saved session');
            // Clear any saved session cookies to force activation
            this.deleteCookie('authToken');
            this.deleteCookie('username');
            // AuthUI.init() already called checkURLForActivation()
            return; // Don't check saved session
        }

        // Check for saved session only if no activation token
        const hasSavedSession = this.checkSavedSession();
        
        // Only initialize terminal if we have a saved session
        if (hasSavedSession) {
            console.log('Saved session found, initializing terminal');
            this.initializeTerminal();
            this.connect();
        } else {
            console.log('No saved session, waiting for login');
        }

        // Setup event listeners
        this.setupEventListeners();
    },

    initializeTerminal() {
        if (this.terminalInitialized) {
            console.log('Terminal already initialized');
            return;
        }
        
        console.log('Initializing terminal...');
        TerminalManager.init();
        this.terminalInitialized = true;
    },

    setupEventListeners() {

        // Event listeners (replacing inline onclick)
        document.getElementById('btn-refresh')?.addEventListener('click', () => this.forceRefresh());
        document.getElementById('btn-reconnect')?.addEventListener('click', () => this.reconnect());
        document.getElementById('btn-reset')?.addEventListener('click', () => this.clearSession());
        document.getElementById('btn-logout')?.addEventListener('click', () => this.logout());
        document.getElementById('admin-link')?.addEventListener('click', () => AdminUI.show());
        document.getElementById('btn-mobile-send')?.addEventListener('click', () => this.sendMobileInput());

        document.getElementById('mobile-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMobileInput();
        });
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && TerminalManager.ws && TerminalManager.ws.readyState === WebSocket.OPEN) {
                setTimeout(() => TerminalManager.forceRefresh(), 200);
            }
        });

        // Prevent accidental close
        window.addEventListener('beforeunload', (e) => {
            if (TerminalManager.ws && TerminalManager.ws.readyState === WebSocket.OPEN) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Admin link click
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
            adminLink.addEventListener('click', () => {
                AdminUI.show();
            });
        }

        // Mobile input
        const mobileInput = document.getElementById('mobile-input');
        if (mobileInput) {
            mobileInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendMobileInput();
            });
        }
    },

    checkSavedSession() {
        const token = this.getCookie('authToken');
        const username = this.getCookie('username');

        if (token && username) {
            console.log('Found saved session for:', username);
            this.authToken = token;
            this.username = username;
            this.checkAdminStatus();
            AuthUI.hide();
            return true;
        }
        
        console.log('No saved session found');
        return false;
    },

    async checkAdminStatus() {
        try {
            await API.getSettings(this.authToken);
            this.isAdmin = true;
            this.updateAdminUI();
        } catch {
            this.isAdmin = false;
        }
    },

    handleLoginSuccess(data) {
        console.log('Login successful, initializing terminal');
        this.authToken = data.token;
        this.username = data.username;
        this.isAdmin = data.isAdmin || false;

        this.setCookie('authToken', data.token, 30);
        this.setCookie('username', data.username, 30);

        this.updateAdminUI();
        AuthUI.hide();
        
	// If there was a ghost terminal from a previous user, kill it first
    	if (this.terminalInitialized) {
        	TerminalManager.disconnect();
        	this.terminalInitialized = false;
    	}

        // Initialize terminal on first login
        this.initializeTerminal();
        this.connect();
    },

    connect() {
        if (!this.terminalInitialized) {
            console.error('Cannot connect: terminal not initialized');
            return;
        }

	// NEW GUARD: If the terminal is already "Connecting" or "Open", don't do it again!
    	if (TerminalManager.ws && (TerminalManager.ws.readyState === WebSocket.CONNECTING || TerminalManager.ws.readyState === WebSocket.OPEN)) {
        	console.log('Terminal already connected or connecting, skipping...');
        	return;
    	}
        
        console.log('Connecting to terminal...');
        this.manualDisconnect = false;
        TerminalManager.connect(this.authToken);
        this.updateUserInfo();
    },

    reconnect() {
        if (TerminalManager.reconnectTimer) {
            clearTimeout(TerminalManager.reconnectTimer);
            TerminalManager.reconnectTimer = null;
        }
        TerminalManager.reconnectAttempts = 0;
        this.manualDisconnect = false;

        if (this.authToken) {
            if (TerminalManager.ws) TerminalManager.ws.close();
            this.connect();
        } else {
            AuthUI.show();
        }
    },

    async logout() {
        console.log('Logging out...');
        this.manualDisconnect = true;

        if (this.authToken) {
            try {
                await API.logout(this.authToken);
            } catch (e) {
                console.error('Logout error:', e);
            }
        }

        if (this.terminalInitialized) {
            TerminalManager.disconnect();
	    this.terminalInitialized = false; // Reset the flag!
        }
        
        this.authToken = null;
        this.username = null;
        this.isAdmin = false;

        this.deleteCookie('authToken');
        this.deleteCookie('username');

        this.updateStatus('disconnected', 'Disconnected');
        document.getElementById('user-info').textContent = '';
        document.getElementById('admin-link').style.display = 'none';

        AuthUI.show();
    },

    async clearSession() {
        if (!confirm('Reset your irssi session? This will clear all history and settings.')) {
            return;
        }

        try {
            await API.clearSession(this.authToken);
            this.showMessage('Session cleared. Reconnecting...', 'success');
            setTimeout(() => this.reconnect(), 1000);
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    },

    forceRefresh() {
        if (!this.terminalInitialized) {
            console.warn('Terminal not initialized');
            return;
        }
        
        TerminalManager.forceRefresh();
        this.updateStatus('connected', 'Refreshing...');
        setTimeout(() => {
            this.updateStatus('connected', 'Connected');
        }, 500);
    },

    sendMobileInput() {
        const input = document.getElementById('mobile-input');
        if (!input) return;
        
        const text = input.value;
        
        if (text && TerminalManager.ws && TerminalManager.ws.readyState === WebSocket.OPEN) {
            TerminalManager.ws.send(JSON.stringify({
                type: 'input',
                data: text + '\r'
            }));
            input.value = '';
        }
    },

    updateStatus(status, text) {
        const dot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (dot) dot.className = 'status-dot ' + status;
        if (statusText) statusText.textContent = text;
    },

    updateUserInfo() {
        const userInfo = document.getElementById('user-info');
        if (this.username && userInfo) {
            userInfo.textContent = `(${this.username})`;
        }
    },

    updateAdminUI() {
        const adminLink = document.getElementById('admin-link');
        if (adminLink) {
            adminLink.style.display = this.isAdmin ? 'inline' : 'none';
        }
    },

    showMessage(message, type = 'error') {
        // Simple toast - could be improved with a proper toast component
        alert(message);
    },

    // Cookie helpers
    setCookie(name, value, days) {
        const expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    },

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    },

    deleteCookie(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
};

// EXPLICITLY ATTACH TO WINDOW IMMEDIATELY
window.app = app;

const initAll = () => {
    // Check if we already initialized to prevent double-runs
    if (window.app_is_running) return;
    window.app_is_running = true;

    app.init();
};

//  HANDLE DOM LOADING
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}

// Global references for inline onclick handlers
const authUI = AuthUI;
const adminUI = AdminUI;

