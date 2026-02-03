const AuthUI = {
    currentMode: 'login', // 'login' or 'activate'
    activationToken: null,

    init() {
        this.render();
        this.checkURLForActivation();
    },

    checkURLForActivation() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        if (token) {
            this.showActivation(token);
        }
    },

    render() {
        const formContainer = document.getElementById('auth-form');
        
        if (this.currentMode === 'login') {
            formContainer.innerHTML = `
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="username" placeholder="Your nickname" autocomplete="username" autocapitalize="off">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="Enter password" autocomplete="current-password">
                </div>
                <button class="btn btn-primary btn-lg" onclick="authUI.login()">Login</button>
                <div class="message error" id="auth-error"></div>
                <div class="message success" id="auth-success"></div>
            `;

            // Enter key handlers
            document.getElementById('password').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.login();
            });
            document.getElementById('username').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('password').focus();
            });
        } else if (this.currentMode === 'activate') {
            formContainer.innerHTML = `
                <div style="margin-bottom: 20px; padding: 15px; background: var(--bg-tertiary); border-radius: 4px;">
                    <div style="color: var(--text-secondary); font-size: 12px;">Activating account for:</div>
                    <div style="color: var(--text-primary); font-size: 16px; margin-top: 5px;" id="activate-username"></div>
                    <div style="color: var(--text-tertiary); font-size: 11px; margin-top: 5px;" id="activate-email"></div>
                </div>
                <div class="form-group">
                    <label>Set Your Password</label>
                    <input type="password" id="activate-password" placeholder="Min 6 characters" autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label>Confirm Password</label>
                    <input type="password" id="activate-confirm" placeholder="Re-enter password" autocomplete="new-password">
                </div>
                <button class="btn btn-primary btn-lg" onclick="authUI.activate()">Activate Account</button>
                <div class="message error" id="auth-error"></div>
                <div class="message success" id="auth-success"></div>
            `;

            document.getElementById('activate-confirm').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.activate();
            });
        }
    },

    async showActivation(token) {
        this.activationToken = token;
        this.currentMode = 'activate';
        document.getElementById('auth-title').textContent = 'Activate Your Account';
        this.render();

        try {
            const info = await API.getActivationInfo(token);
            document.getElementById('activate-username').textContent = info.username || 'Unknown';
            document.getElementById('activate-email').textContent = info.email || '';
        } catch (error) {
            this.showError(error.message);
        }
    },

    async login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            this.showError('Please enter username and password');
            return;
        }

        try {
            const data = await API.login(username, password);
            this.showSuccess('Login successful!');
            
            setTimeout(() => {
                app.handleLoginSuccess(data);
            }, 500);
        } catch (error) {
            this.showError(error.message);
        }
    },

    async activate() {
        const password = document.getElementById('activate-password').value;
        const confirm = document.getElementById('activate-confirm').value;

        if (!password || !confirm) {
            this.showError('Please enter and confirm password');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirm) {
            this.showError('Passwords do not match');
            return;
        }

        try {
            const data = await API.activate(this.activationToken, password);
            this.showSuccess('Account activated! You can now login.');
            
            setTimeout(() => {
                this.currentMode = 'login';
                document.getElementById('auth-title').textContent = 'Login';
                this.render();
                document.getElementById('username').value = data.username;
                window.history.pushState({}, '', '/');
            }, 2000);
        } catch (error) {
            this.showError(error.message);
        }
    },

    showError(message) {
        const el = document.getElementById('auth-error');
        el.textContent = message;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 5000);
    },

    showSuccess(message) {
        const el = document.getElementById('auth-success');
        el.textContent = message;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 3000);
    },

    show() {
        document.getElementById('auth-modal').classList.add('show');
    },

    hide() {
        document.getElementById('auth-modal').classList.remove('show');
    }
};
