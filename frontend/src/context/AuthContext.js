import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config'; // ✅ FIXED: was './config', should be '../config'

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await axios.get(
          config.getApiUrl(config.endpoints.auth + '/me'),
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        setUser(response.data.data);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    try {
      const response = await axios.post(
        config.getApiUrl(config.endpoints.auth + '/login'),
        { email, password }
      );
      if (response.data.success) {
        localStorage.setItem('token', response.data.data.token);
        setUser(response.data.data.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(
        config.getApiUrl(config.endpoints.auth + '/register'),
        userData
      );
      if (response.data.success) {
        localStorage.setItem('token', response.data.data.token);
        setUser(response.data.data.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Registration failed' };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateProfile = async (profileData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        config.getApiUrl(config.endpoints.users + '/profile'),
        profileData,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.data.success) {
        setUser(response.data.data);
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Update failed' };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Update failed' };
    }
  };

  const value = { user, isAuthenticated, loading, login, register, logout, updateProfile, loadUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};