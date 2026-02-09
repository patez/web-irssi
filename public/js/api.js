const API = {
    baseURL: window.location.origin,

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
	    ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    },

    async login(username, password) {
        return this.request('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    async logout(token) {
        return this.request('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    async activate(token, password) {
        return this.request('/api/activate', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    },

    async getActivationInfo(token) {
        return this.request(`/api/activate/${token}`);
    },

    // Admin endpoints
    async getUsers(token) {
        return this.request('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    async createUser(token, username, email, isAdmin) {
        return this.request('/api/admin/users', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username, email, isAdmin })
        });
    },

    async deleteUser(token, userId) {
        return this.request(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    async resetPassword(token, userId, newPassword) {
        return this.request(`/api/admin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ newPassword })
        });
    },

    async getSettings(token) {
        return this.request('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    },

    async updateSettings(token, settings) {
        return this.request('/api/admin/settings', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(settings)
        });
    },

    async clearSession(token) {
        return this.request('/api/admin/clear-session', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }
};
