/**
 * API Configuration
 * Centralizirane konfiguracije za API endpoints
 */

// Base URL za API - može se promijeniti ovisno o okruženju
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8080' // Development
  : 'https://api.production.com'; // Production

/**
 * API verzija
 */
const API_VERSION = 'v1';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  AUTH: {
    REGISTER: `/api/${API_VERSION}/auth/register`,
    LOGIN: `/api/${API_VERSION}/auth/login`,
  },
  // Ovdje možeš dodati druge endpoint grupe u budućnosti
  // USER: {
  //   PROFILE: `/api/${API_VERSION}/user/profile`,
  // },
} as const;

/**
 * Puni URL za API endpoints
 */
export const getFullUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

export default {
  BASE_URL: API_BASE_URL,
  VERSION: API_VERSION,
  ENDPOINTS: API_ENDPOINTS,
  getFullUrl,
};
