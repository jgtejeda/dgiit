/**
 * SGC PRO | API Client
 * Cliente para interactuar con el backend Node.js/Express
 */

const API_BASE_URL = 'http://localhost:3000/api';

// Configuración de la API
const apiClient = {
    // --- AUTENTICACIÓN ---
    async login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error en login:', error);
            return { success: false, message: 'Error de conexión con el servidor' };
        }
    },

    // --- USUARIOS ---
    async getUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/users`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            return { success: false, data: [] };
        }
    },

    async createUser(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creando usuario:', error);
            return { success: false };
        }
    },

    async updateUser(id, userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error actualizando usuario:', error);
            return { success: false };
        }
    },

    async deleteUser(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            return { success: false };
        }
    },

    // --- TAREAS ---
    async getTasks() {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo tareas:', error);
            return { success: false, data: [] };
        }
    },

    async createTask(taskData) {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creando tarea:', error);
            return { success: false };
        }
    },

    async updateTask(id, taskData) {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error actualizando tarea:', error);
            return { success: false };
        }
    },

    async deleteTask(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error eliminando tarea:', error);
            return { success: false };
        }
    },

    // --- LOGS ---
    async getLogs() {
        try {
            const response = await fetch(`${API_BASE_URL}/logs`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error obteniendo logs:', error);
            return { success: false, data: [] };
        }
    },

    async saveLog(logData) {
        try {
            const response = await fetch(`${API_BASE_URL}/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData)
            });
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error guardando log:', error);
            return { success: false };
        }
    }
};

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}
