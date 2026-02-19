import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  fetchWithRetry, 
  createApiError, 
  logApiError, 
  parseErrorBody,
  getErrorMessage,
  type ApiError 
} from '@/lib/api-utils';

export interface QueueItem {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  position: number;
  estimatedWaitSeconds: number;
  prompt: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  resultImage?: {
    id: string;
    url: string;
    prompt: string;
    model_label: string;
  };
}

export interface QueueStats {
  queued_count: number;
  processing_count: number;
  completed_today: number;
  average_wait_seconds: number;
}

export interface GenerationRequest {
  prompt: string;
  aspectRatio: string;
  quality: '2K' | '4K';
  presetId: string;
  cameraAngle?: string;
  focalLength: string;
  aperture: string;
  filmLook?: string | null;
  referenceImages?: string[]; // Base64 images for Smart Reference
  useOwnKey?: boolean; // BYOK: use user's own API key
  sequenceMode?: boolean; // Sequence mode: treat ref image as previous scene
  sequenceKeepCharacter?: boolean; // Keep character consistency
  sequenceKeepScenery?: boolean; // Keep scenery/environment consistency
  storyboard6Mode?: boolean; // Storyboard 6-panel mode
}

interface QueueResponse {
  success: boolean;
  queueId: string;
  status: string;
  position: number;
  estimatedWaitSeconds: number;
  creditsCost: number;
  message: string;
}

export interface QueueError extends Error {
  apiError?: ApiError;
  suggestedAction?: 'retry' | 'login' | 'wait' | 'none';
}

export function useGenerationQueue(userId?: string) {
  const [activeItems, setActiveItems] = useState<QueueItem[]>([]);
  const [globalStats, setGlobalStats] = useState<QueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's active queue items
  const fetchQueueStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-queue-status', {
        method: 'GET',
      });

      if (error) throw error;

      if (data) {
        setActiveItems(data.userItems?.map((item: any) => ({
          id: item.id,
          status: item.status,
          position: 0, // Will be calculated
          estimatedWaitSeconds: 0,
          prompt: item.prompt,
          createdAt: item.created_at,
          startedAt: item.started_at,
          completedAt: item.completed_at,
          errorMessage: item.error_message,
        })) || []);
        
        setGlobalStats(data.globalStats);
      }
    } catch (error) {
      console.error('Error fetching queue status:', error);
    }
  }, [userId]);

  // Check specific item status
  const checkItemStatus = useCallback(async (queueId: string): Promise<QueueItem | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-queue-status?id=${queueId}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        id: data.id,
        status: data.status,
        position: data.position || 0,
        estimatedWaitSeconds: data.estimatedWaitSeconds || 0,
        prompt: '',
        createdAt: data.createdAt,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        errorMessage: data.errorMessage,
        resultImage: data.resultImage,
      };
    } catch (error) {
      console.error('Error checking item status:', error);
      return null;
    }
  }, []);

  // Add to queue with retry and detailed error handling
  const queueGeneration = useCallback(async (request: GenerationRequest): Promise<QueueResponse> => {
    setIsLoading(true);
    const requestId = crypto.randomUUID();
    
    try {
      // Get auth token
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.access_token) {
        const apiError = createApiError(401, sessionError, 'Sessão expirada. Por favor, faça login novamente.');
        logApiError('QUEUE_GENERATION', apiError, { requestId, userId });
        
        const error = new Error(apiError.message) as QueueError;
        error.apiError = apiError;
        error.suggestedAction = 'login';
        throw error;
      }

      const token = sessionData.session.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-image-generation`;

      // Use fetchWithRetry for automatic retry on transient errors
      const response = await fetchWithRetry(
        () => fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(request),
        }),
        {
          maxRetries: 3,
          context: 'QUEUE_GENERATION',
          onRetry: (attempt, delay, status) => {
            console.log(`[QUEUE_GENERATION] Retry attempt ${attempt}, waiting ${delay}ms (status: ${status})`);
          },
        }
      );

      // Parse response
      const responseText = await response.text();
      let data: any;
      
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText || 'Resposta inválida do servidor' };
      }

      // Handle non-OK responses
      if (!response.ok) {
        const apiError = createApiError(
          response.status, 
          data,
          data?.error || data?.message || getErrorMessage(response.status)
        );
        
        logApiError('QUEUE_GENERATION', apiError, {
          requestId,
          userId,
          responseStatus: response.status,
          responseBody: data,
        });

        const error = new Error(apiError.message) as QueueError;
        error.apiError = apiError;
        error.suggestedAction = apiError.suggestedAction;
        throw error;
      }

      // Check for error in response body
      if (data?.error) {
        const apiError = createApiError(400, data, data.error);
        logApiError('QUEUE_GENERATION', apiError, { requestId, userId, data });
        
        const error = new Error(data.error) as QueueError;
        error.apiError = apiError;
        throw error;
      }

      // Success - In direct generation mode, we don't wait for queue
      console.log('[QUEUE_GENERATION] Direct generation success:', data);

      // Refresh queue and gallery status
      await fetchQueueStatus();

      return data as QueueResponse;
    } catch (error) {
      // Re-throw QueueError as-is
      if ((error as QueueError).apiError) {
        throw error;
      }

      // Network error or other unexpected error
      const isNetworkError = error instanceof TypeError && error.message.includes('fetch');
      const apiError = createApiError(
        isNetworkError ? 0 : 500,
        error,
        isNetworkError 
          ? 'Problema de conexão. Verifique sua internet e tente novamente.'
          : (error instanceof Error ? error.message : 'Erro inesperado')
      );

      logApiError('QUEUE_GENERATION', apiError, {
        requestId,
        userId,
        errorType: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      const queueError = new Error(apiError.message) as QueueError;
      queueError.apiError = apiError;
      queueError.suggestedAction = apiError.suggestedAction;
      throw queueError;
    } finally {
      setIsLoading(false);
    }
  }, [fetchQueueStatus, userId]);

  // Poll for updates on active items
  useEffect(() => {
    if (!userId || activeItems.length === 0) return;

    const pollInterval = setInterval(async () => {
      const hasActiveItems = activeItems.some(
        item => item.status === 'queued' || item.status === 'processing'
      );

      if (hasActiveItems) {
        await fetchQueueStatus();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [userId, activeItems, fetchQueueStatus]);

  // NOTE: Realtime subscription for queue updates is handled in Index.tsx
  // to avoid duplicate channels and ensure single source of truth for gallery state

  // Initial fetch
  useEffect(() => {
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  return {
    activeItems,
    globalStats,
    isLoading,
    queueGeneration,
    checkItemStatus,
    refetch: fetchQueueStatus,
  };
}
