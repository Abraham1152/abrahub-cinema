/**
 * API Utilities - Retry with exponential backoff and error handling
 */

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableStatuses: [0, 502, 503, 504],
};

// Error messages mapped to status codes
export const ERROR_MESSAGES: Record<number, string> = {
  0: 'Problema de conexão. Verifique sua internet e tente novamente.',
  401: 'Sessão expirada. Por favor, faça login novamente.',
  402: 'Créditos insuficientes.',
  403: 'Acesso negado.',
  408: 'Tempo de resposta excedido. Tente novamente.',
  429: 'Muitas requisições. Aguarde alguns segundos.',
  500: 'Erro interno. Nossa equipe foi notificada.',
  502: 'Servidor temporariamente indisponível.',
  503: 'Servidor ocupado. Tente novamente em alguns segundos.',
  504: 'Tempo de resposta excedido. Tente novamente.',
};

// Error types for handling
export type ApiErrorType = 
  | 'network' 
  | 'auth' 
  | 'credits' 
  | 'server' 
  | 'timeout' 
  | 'rate_limit'
  | 'unknown';

export interface ApiError {
  type: ApiErrorType;
  status: number;
  message: string;
  originalError?: unknown;
  shouldRetry: boolean;
  suggestedAction?: 'retry' | 'login' | 'wait' | 'none';
}

/**
 * Get error type from status code
 */
export function getErrorType(status: number): ApiErrorType {
  if (status === 0) return 'network';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'credits';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * Get user-friendly error message from status code
 */
export function getErrorMessage(status: number, fallback?: string): string {
  return ERROR_MESSAGES[status] || fallback || 'Erro desconhecido. Tente novamente.';
}

/**
 * Create a structured API error
 */
export function createApiError(
  status: number, 
  originalError?: unknown,
  customMessage?: string
): ApiError {
  const type = getErrorType(status);
  const shouldRetry = RETRY_CONFIG.retryableStatuses.includes(status);
  
  let suggestedAction: ApiError['suggestedAction'] = 'none';
  if (shouldRetry) suggestedAction = 'retry';
  else if (type === 'auth') suggestedAction = 'login';
  else if (type === 'rate_limit') suggestedAction = 'wait';

  return {
    type,
    status,
    message: customMessage || getErrorMessage(status),
    originalError,
    shouldRetry,
    suggestedAction,
  };
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Log error details for debugging
 */
export function logApiError(
  context: string,
  error: ApiError,
  additionalInfo?: Record<string, unknown>
): void {
  console.error(`[${context}] API Error:`, {
    type: error.type,
    status: error.status,
    message: error.message,
    shouldRetry: error.shouldRetry,
    suggestedAction: error.suggestedAction,
    timestamp: new Date().toISOString(),
    ...additionalInfo,
  });
}

interface FetchWithRetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, delay: number, status: number) => void;
  context?: string;
}

/**
 * Fetch with automatic retry for transient errors
 * Uses exponential backoff: 1s, 2s, 4s
 */
export async function fetchWithRetry(
  fn: () => Promise<Response>,
  options?: FetchWithRetryOptions
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? RETRY_CONFIG.maxRetries;
  const context = options?.context ?? 'API';
  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();
      lastResponse = response;

      // If success or non-retryable error, return immediately
      if (response.ok || !RETRY_CONFIG.retryableStatuses.includes(response.status)) {
        return response;
      }

      // Retryable error - check if we have retries left
      if (attempt < maxRetries) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.log(`[${context}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status: ${response.status})`);
        options?.onRetry?.(attempt + 1, delay, response.status);
        await sleep(delay);
        continue;
      }

      // No more retries, return the last response
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Network error (status 0) - retry if possible
      if (attempt < maxRetries) {
        const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
        console.log(`[${context}] Network error, retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        options?.onRetry?.(attempt + 1, delay, 0);
        await sleep(delay);
        continue;
      }
    }
  }

  // All retries exhausted
  if (lastResponse) {
    return lastResponse;
  }

  // Only network errors occurred
  throw lastError || new Error('Todas as tentativas falharam');
}

/**
 * Parse error response body safely
 */
export async function parseErrorBody(response: Response): Promise<{ error?: string; message?: string; code?: string }> {
  try {
    const text = await response.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
