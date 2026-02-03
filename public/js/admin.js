const AdminUI = {
    isOpen: false,

    async show() {
        if (!app.isAdmin) return;

        this.isOpen = true;
        this.render();
        await this.loadData();
    },

    hide() {
        this.isOpen = false;
        document.getElementById('admin-panel').classList.remove('show');
    },

    render() {
        const panel = document.getElementById('admin-panel');
        panel.innerHTML = `
            <div class="admin-container">
                <div class="admin-header">
                    <h2>Admin Panel</h2>
                    <button class="btn btn-danger" onclick="adminUI.hide()">Close</button>
                </div>

                <div class="admin-section">
                    <h3>Statistics</h3>
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value" id="stat-users">0</div>
                            <div class="stat-label">Total Users</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="stat-max">10</div>
                            <div class="stat-label">Max Users</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="stat-active">0</div>
                            <div class="stat-label">Active Sessions</div>
                        </div>
                    </div>
                </div>

                <div class="admin-section">
                    <h3>Settings</h3>
                    <div class="settings-row">
                        <label>Maximum Users</label>
                        <input type="number" id="max-users-input" min="1" max="1000" value="10">
                        <button class="btn btn-primary" onclick="adminUI.saveSettings()">Save</button>
                    </div>
                </div>

                <div class="admin-section">
                    <h3>Users</h3>
                    <div style="margin-bottom: 15px;">
                        <button class="btn btn-primary" onclick="adminUI.toggleCreateForm()">+ Create New User</button>
                    </div>

                    <div id="create-user-form" style="display: none; background: var(--bg-tertiary); padding: 20px; border-radius: 4px; margin-bottom: 15px;">
                        <h4 style="color: var(--text-primary); margin-bottom: 15px;">Create New User</h4>
                        <div class="form-row">
                            <label>Username</label>
                            <input type="text" id="new-username" placeholder="username">
                        </div>
                        <div class="form-row">
                            <label>Email</label>
                            <input type="email" id="new-email" placeholder="user@example.com">
                        </div>
                        <div class="checkbox-group" style="margin-bottom: 15px;">
                            <input type="checkbox" id="new-is-admin">
                            <label for="new-is-admin">Make this user an admin</label>
                        </div>
                        <div class="form-inline">
                            <button class="btn btn-primary" onclick="adminUI.createUser()">Create & Send Email</button>
                            <button class="btn" onclick="adminUI.toggleCreateForm()">Cancel</button>
                        </div>
                    </div>

                    <div class="table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Created</th>
                                    <th>Last Login</th>
                                    <th>Status</th>
                                    <th>Admin</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="users-list">
                                <tr><td colspan="7" style="text-align: center; color: var(--text-tertiary);">Loading...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        panel.classList.add('show');
    },

    async loadData() {
        try {
            // Load settings
            const settings = await API.getSettings(app.authToken);
            document.getElementById('stat-users').textContent = settings.currentUsers;
            document.getElementById('stat-max').textContent = settings.maxUsers;
            document.getElementById('stat-active').textContent = settings.activeSessions;
            document.getElementById('max-users-input').value = settings.maxUsers;

            // Load users
            const data = await API.getUsers(app.authToken);
            this.renderUsers(data.users);
        } catch (error) {
            app.showMessage('Failed to load admin data: ' + error.message, 'error');
        }
    },

    renderUsers(users) {
        const tbody = document.getElementById('users-list');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-tertiary);">No users</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.username}</td>
                <td>${user.email || '-'}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td>${user.is_activated ? '<span style="color: var(--success);">Active</span>' : '<span style="color: var(--warning);">Pending</span>'}</td>
                <td>${user.is_admin ? '✓' : ''}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn" onclick="adminUI.resetPassword(${user.id}, '${user.username}')">Reset</button>
                        <button class="btn btn-danger" onclick="adminUI.deleteUser(${user.id}, '${user.username}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    toggleCreateForm() {
        const form = document.getElementById('create-user-form');
        const isVisible = form.style.display !== 'none';
        form.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            document.getElementById('new-username').value = '';
            document.getElementById('new-email').value = '';
            document.getElementById('new-is-admin').checked = false;
        }
    },

    async createUser() {
        const username = document.getElementById('new-username').value.trim();
        const email = document.getElementById('new-email').value.trim();
        const isAdmin = document.getElementById('new-is-admin').checked;

        if (!username || !email) {
            app.showMessage('Username and email required', 'error');
            return;
        }

        try {
            const data = await API.createUser(app.authToken, username, email, isAdmin);
            app.showMessage('User created! Activation email sent.', 'success');
            this.toggleCreateForm();
            await this.loadData();
            
            if (data.activationLink) {
                console.log('Activation link:', data.activationLink);
            }
        } catch (error) {
            app.showMessage(error.message, 'error');
        }
    },

    async deleteUser(userId, username) {
        if (!confirm(`Delete user "${username}"? This will remove all their data and cannot be undone.`)) {
            return;
        }

        try {
            await API.deleteUser(app.authToken, userId);
            app.showMessage(`User "${username}" deleted`, 'success');
            await this.loadData();
        } catch (error) {
            app.showMessage(error.message, 'error');
        }
    },

    async resetPassword(userId, username) {
        const newPassword = prompt(`Enter new password for "${username}" (min 6 characters):`);
        
        if (!newPassword || newPassword.length < 6) {
            app.showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            await API.resetPassword(app.authToken, userId, newPassword);
            app.showMessage(`Password reset for "${username}"`, 'success');
        } catch (error) {
            app.showMessage(error.message, 'error');
        }
    },

    async saveSettings() {
        const maxUsers = parseInt(document.getElementById('max-users-input').value);

        try {
            await API.updateSettings(app.authToken, { maxUsers });
            app.showMessage('Settings saved!', 'success');
            await this.loadData();
        } catch (error) {
            app.showMessage(error.message, 'error');
        }
    }
};
