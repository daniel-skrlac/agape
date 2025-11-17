import { ApiResponse, ApiError } from '../types/api.types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  token?: string;
}

/**
 * Kreira headers za API poziv
 */
const createHeaders = (token?: string, customHeaders?: Record<string, string>): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Procesira API odgovor
 */
const processResponse = async <T>(response: Response): Promise<ApiResponse<T>> => {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  let data: any;
  if (isJson) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const error: ApiError = {
      message: data.message || 'Došlo je do greške',
      code: data.code,
      statusCode: response.status,
      details: data.details,
    };

    return {
      success: false,
      error,
    };
  }

  return {
    success: true,
    data,
  };
};

 // Glavni HTTP client
export const httpClient = {
    //GET 
  async get<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: createHeaders(options?.token, options?.headers),
      });

      return await processResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Mrežna greška',
          statusCode: 0,
        },
      };
    }
  },

  // POST 
  async post<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: createHeaders(options?.token, options?.headers),
        body: body ? JSON.stringify(body) : undefined,
      });

      return await processResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Mrežna greška',
          statusCode: 0,
        },
      };
    }
  },

  // PUT
  async put<T>(url: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: createHeaders(options?.token, options?.headers),
        body: body ? JSON.stringify(body) : undefined,
      });

      return await processResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Mrežna greška',
          statusCode: 0,
        },
      };
    }
  },

  // DELETE
  async delete<T>(url: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: createHeaders(options?.token, options?.headers),
      });

      return await processResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Mrežna greška',
          statusCode: 0,
        },
      };
    }
  },
};
