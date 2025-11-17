/**
 * Request tip za registraciju korisnika
 */
export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  // Dodaj ostala polja koja backend očekuje
}

// Request tip za prijavu korisnika
export interface LoginRequest {
  email: string;
  password: string;
}

// tip responesa za registraciju
export interface AuthResponseRegister{
  status: string;
  message: string;
  statusCode: number;
  data: {
    userId: string;
    username: string;
    name?: string;
  };
}

// tip responsea za prijavu
export interface AuthResponseLogin {
  status: string;
  message: string;
  statusCode: number;
  data: {
    userId: string;
    username: string;
    name?: string;
    token: string;
  };
}

/**
 * Generički tip za API grešku
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Generički tip za API odgovor
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
