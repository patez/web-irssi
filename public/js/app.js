const app = {
    authToken: null,
    username: null,
    isAdmin: false,
    manualDisconnect: false,

    init() {
        // Initialize terminal
        TerminalManager.init();

        // Initialize auth UI
        AuthUI.init();

        // Check for saved session
        this.checkSavedSession();

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
        document.getElementById('admin-link').addEventListener('click', () => {
            AdminUI.show();
        });

        // Mobile input
        document.getElementById('mobile-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMobileInput();
        });
    },

    checkSavedSession() {
        const token = this.getCookie('authToken');
        const username = this.getCookie('username');

        if (token && username) {
            this.authToken = token;
            this.username = username;
            this.checkAdminStatus();
            AuthUI.hide();
            this.connect();
        }
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
        this.authToken = data.token;
        this.username = data.username;
        this.isAdmin = data.isAdmin || false;

        this.setCookie('authToken', data.token, 30);
        this.setCookie('username', data.username, 30);

        this.updateAdminUI();
        AuthUI.hide();
        this.connect();
    },

    connect() {
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
        this.manualDisconnect = true;

        if (this.authToken) {
            try {
                await API.logout(this.authToken);
            } catch (e) {
                console.error('Logout error:', e);
            }
        }

        TerminalManager.disconnect();
        
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
        TerminalManager.forceRefresh();
        this.updateStatus('connected', 'Refreshing...');
        setTimeout(() => {
            this.updateStatus('connected', 'Connected');
        }, 500);
    },

    sendMobileInput() {
        const input = document.getElementById('mobile-input');
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

        dot.className = 'status-dot ' + status;
        statusText.textContent = text;
    },

    updateUserInfo() {
        if (this.username) {
            document.getElementById('user-info').textContent = `(${this.username})`;
        }
    },

    updateAdminUI() {
        document.getElementById('admin-link').style.display = this.isAdmin ? 'inline' : 'none';
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

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Global references for inline onclick handlers
const authUI = AuthUI;
const adminUI = AdminUI;
