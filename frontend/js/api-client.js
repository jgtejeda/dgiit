/**
 * SGC PRO | API Client
 * Cliente para interactuar con el backend Node.js/Express
 */

const API_BASE_URL = '/api-dgiit/api';

const apiClient = {
    // --- SESIÓN ---
    getToken() { return localStorage.getItem('sgc_token'); },
    setToken(token) { localStorage.setItem('sgc_token', token); },
    clearSession() { 
        localStorage.removeItem('sgc_token'); 
        localStorage.removeItem('sgc_user');
        window.location.reload(); 
    },

    // --- HELPER DE PETICIÓN ---
    async request(path, options = {}) {
        const url = `${API_BASE_URL}${path}`;
        const token = this.getToken();
        const defaultHeaders = { 'Content-Type': 'application/json' };
        if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
        const config = { 
            ...options, 
            mode: 'cors',
            credentials: 'include',
            headers: { ...defaultHeaders, ...options.headers } 
        };
        try {
            console.log(`🚀 API Request: ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, config);
            if (response.status === 401 && !path.includes('/login')) {
                console.warn('Sesión expirada o no autorizada. Redirigiendo...');
                this.clearSession();
                return { success: false, message: 'Sesión expirada' };
            }
            if (!response.ok) {
                const text = await response.text();
                return { success: false, message: `Error ${response.status}: ${text.substring(0, 50)}` };
            }
            return await response.json();
        } catch (error) {
            console.error(`Error en API (${path}):`, error);
            return { success: false, message: 'Fallo de conexión (CORS, Red o Firewall)' };
        }
    },

    // --- AUTENTICACIÓN ---
    async login(email, password) {
        const data = await this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (data.success && data.token) {
            this.setToken(data.token);
            localStorage.setItem('sgc_user', JSON.stringify(data.user));
        }
        return data;
    },

    // --- USUARIOS ---
    async getUsers() { return this.request('/users'); },
    async createUser(userData) {
        return this.request('/users', { method: 'POST', body: JSON.stringify(userData) });
    },
    async updateUser(id, userData) {
        return this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(userData) });
    },
    async deleteUser(id) {
        return this.request(`/users/${id}`, { method: 'DELETE' });
    },
    async updateProfile(profileData) {
        return this.request('/profile', { method: 'PUT', body: JSON.stringify(profileData) });
    },

    // --- TAREAS ---
    async getTasks() { return this.request('/tasks'); },
    async createTask(taskData) {
        return this.request('/tasks', { method: 'POST', body: JSON.stringify(taskData) });
    },
    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(taskData) });
    },
    async deleteTask(id) {
        return this.request(`/tasks/${id}`, { method: 'DELETE' });
    },

    // --- ETAPAS (TODOS) ---
    async getTodos(taskId) { return this.request(`/tasks/${taskId}/todos`); },
    async createTodo(taskId, label, assignedTo = null) {
        return this.request(`/tasks/${taskId}/todos`, {
            method: 'POST',
            body: JSON.stringify({ label, assigned_to: assignedTo })
        });
    },
    async toggleTodo(todoId, isDone, assignedTo = undefined) {
        const body = { is_done: isDone };
        if (assignedTo !== undefined) body.assigned_to = assignedTo;
        return this.request(`/todos/${todoId}`, { method: 'PUT', body: JSON.stringify(body) });
    },
    async deleteTodo(todoId) {
        return this.request(`/todos/${todoId}`, { method: 'DELETE' });
    },

    // --- RESPONSABLES (MULTI-ASSIGNEE) ---
    async getAssignees(taskId) { return this.request(`/tasks/${taskId}/assignees`); },
    async addAssignee(taskId, assigneeData) {
        return this.request(`/tasks/${taskId}/assignees`, {
            method: 'POST',
            body: JSON.stringify(assigneeData)
        });
    },
    async removeAssignee(taskId, email) {
        return this.request(`/tasks/${taskId}/assignees/${encodeURIComponent(email)}`, { method: 'DELETE' });
    },

    // --- COMENTARIOS ---
    async getComments(taskId) { return this.request(`/tasks/${taskId}/comments`); },
    async createComment(taskId, content, authorData) {
        return this.request(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ ...authorData, content })
        });
    },

    // --- LOGS ---
    async getLogs() { return this.request('/logs'); },
    async saveLog(logData) {
        return this.request('/logs', { method: 'POST', body: JSON.stringify(logData) });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}
