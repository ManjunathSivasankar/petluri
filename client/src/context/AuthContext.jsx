import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const clearAuthState = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    useEffect(() => {
        // Validate saved auth on app load to avoid stale token sessions.
        const bootstrapAuth = async () => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    await api.get('/auth/me');
                    setUser(parsedUser);
                } catch (error) {
                    clearAuthState();
                }
        }
        setLoading(false);
        };

        bootstrapAuth();
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });

        // Save to local storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data));

        setUser(data);
        return data; // Return full user obj for redirection logic
    };

    const sendOtp = async (email) => {
        const { data } = await api.post('/auth/send-otp', { email });
        return data;
    };

    const loginWithOtp = async (email, otp) => {
        const { data } = await api.post('/auth/verify-otp', { email, otp });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const logout = () => {
        clearAuthState();
        window.location.href = '/login'; // Hard redirect to clear state perfectly
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, sendOtp, loginWithOtp, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
