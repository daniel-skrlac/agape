import { API_ENDPOINTS, getFullUrl } from '../config/api.config';
import { httpClient } from '../utils/httpClient';
import { 
  RegisterRequest, 
  LoginRequest, 
  AuthResponseLogin, 
  AuthResponseRegister,
  ApiResponse 
} from '../types/api.types';

export const authService = {
  async register(data: RegisterRequest): Promise<ApiResponse<AuthResponseRegister>> {
    const url = getFullUrl(API_ENDPOINTS.AUTH.REGISTER);
    return await httpClient.post<AuthResponseRegister>(url, data);
  },

  
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponseLogin>> {
    const url = getFullUrl(API_ENDPOINTS.AUTH.LOGIN);
    return await httpClient.post<AuthResponseLogin>(url, credentials);
  },

  // Odjava korisnika, ne korisitmo jos
  async logout(token: string): Promise<ApiResponse<void>> {
    // Implementiraj ako backend ima logout endpoint
    // const url = getFullUrl(API_ENDPOINTS.AUTH.LOGOUT);
    // return await httpClient.post<void>(url, {}, { token });
    
    // Za sada samo vrati success
    return {
      success: true,
      data: undefined,
    };
  },
};

export const register = authService.register;
export const login = authService.login;
export const logout = authService.logout;
