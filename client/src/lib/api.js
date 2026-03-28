import axios from 'axios';

const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    import.meta.env.VITE_API_URL?.trim() ||
    'http://localhost:5000/api'
);

const clearStoredAuth = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add a request interceptor to inject the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const requestUrl = error?.config?.url || '';
        const hasToken = Boolean(localStorage.getItem('token'));

        // Auto-recover from stale/invalid JWT when switching backend instances.
        if (status === 401 && hasToken && !requestUrl.includes('/auth/login')) {
            clearStoredAuth();

            const onAdminRoute = window.location.pathname.startsWith('/admin');
            const target = onAdminRoute ? '/admin/login' : '/login';

            if (window.location.pathname !== target) {
                window.location.href = target;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
