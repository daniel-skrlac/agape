/**
 * Auth Context (opciono - za globalno upravljanje auth stanjem)
 * Koristi React Context za držanje auth informacija
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/auth.service';
import { LoginRequest, RegisterRequest, AuthResponseLogin, AuthResponseRegister } from '../types/api.types';

// Konstante za storage
const TOKEN_KEY = 'authToken';
const USER_KEY = 'userData';

// Auth Context tip
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthResponseLogin['data'] | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterRequest) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

// Kreiraj Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthResponseLogin['data'] | null>(null);
  const [token, setToken] = useState<string | null>(null);

  /**
   * Provjeri postoji li token pri inicijalizaciji
   */
  const checkAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      const storedUser = await SecureStore.getItemAsync(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login funkcija
   */
  const login = async (credentials: LoginRequest) => {
    try {
      const response = await authService.login(credentials);

      if (response.success && response.data) {
        const { data: userData } = response.data;

        // Spremi u SecureStore
        await SecureStore.setItemAsync(TOKEN_KEY, userData?.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));

        // Postavi state
        setToken(userData?.token || null);
        setUser(userData);
        setIsAuthenticated(true);

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Login failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Unexpected error occurred',
      };
    }
  };

  /**
   * Register funkcija
   */
  const register = async (data: RegisterRequest) => {
    try {
      const response = await authService.register(data);

      if (response.success && response.data) {
        const { data: userData } = response.data;

        // Spremi u SecureStore
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));

        // Postavi state
        setToken(user?.token || null);
        setUser(userData as any);
        setIsAuthenticated(false);

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error?.message || 'Registration failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: 'Unexpected error occurred',
      };
    }
  };

  /**
   * Logout funkcija
   */
  const logout = async () => {
    try {
      // Pozovi backend logout (opciono)
      if (token) {
        await authService.logout(token);
      }

      // Obriši iz SecureStore
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);

      // Reset za state
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  // Provjeri auth pri inicijalizaciji
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    token,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook za korištenje Auth Context-a
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

/**
 * Primjer korištenja:
 * 
 * // 1. Wrappaj app u AuthProvider (_layout.tsx):
 * <AuthProvider>
 *   <Stack />
 * </AuthProvider>
 * 
 * // 2. Koristi u komponentama:
 * const { login, isAuthenticated, user } = useAuth();
 * 
 * const handleLogin = async () => {
 *   const result = await login({ email, password });
 *   if (result.success) {
 *     router.replace('/home');
 *   }
 * };
 */
