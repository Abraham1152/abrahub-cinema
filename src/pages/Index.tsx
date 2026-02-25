import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, Image as ImageIcon, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GalleryGrid, GalleryItem } from '@/components/studio/GalleryGrid';
import { RealismFloatingBar, QualityOption, QUALITY_OPTIONS } from '@/components/studio/RealismFloatingBar';
import { QueueStatusBar } from '@/components/studio/QueueStatusBar';
import { CreditsModal } from '@/components/credits/CreditsModal';
import { ApiKeyOnboardingModal } from '@/components/studio/ApiKeyOnboardingModal';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useGenerationQueue } from '@/hooks/useGenerationQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEFAULT_EQUIPMENT } from '@/config/cinema-equipment';
import { DEFAULT_PRESET } from '@/config/cinema-presets';
import { isExpired } from '@/lib/image-utils';
export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Force password setup before accessing the platform
  useEffect(() => {
    if (!authLoading && user?.user_metadata?.needs_password_setup) {
      localStorage.setItem('abrahub_setup_pending', 'true');
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);
  const { credits, refetch: refetchCredits } = useCredits(user?.id);
  const { activeItems, queueGeneration, isLoading: isQueueLoading, refetch: refetchQueue } = useGenerationQueue(user?.id);

  // Gallery state - use Map for deduplication (key = id)
  const [galleryMap, setGalleryMap] = useState<Map<string, GalleryItem>>(new Map());
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);

  // Tick state for forcing re-renders (timer updates every second)
  const [tick, setTick] = useState(0);

  // Generation state
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_EQUIPMENT.aspectRatio);
  const [batchSize, setBatchSize] = useState(1);
  const [quality, setQuality] = useState<QualityOption>('2K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [sequenceMode, setSequenceMode] = useState(false);
  const [sequenceKeepCharacter, setSequenceKeepCharacter] = useState(false);
  const [sequenceKeepScenery, setSequenceKeepScenery] = useState(false);
  const [storyboard6Mode, setStoryboard6Mode] = useState(false);
  const [hasValidApiKey, setHasValidApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Preset-based equipment state
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_PRESET);
  const [selectedAngle, setSelectedAngle] = useState('eye-level');
  const [selectedFocalLength, setSelectedFocalLength] = useState(DEFAULT_EQUIPMENT.focalLength);
  const [selectedFilmLook, setSelectedFilmLook] = useState<string | null>(null);
  const [selectedAperture, setSelectedAperture] = useState(DEFAULT_EQUIPMENT.aperture);

  // Credits modal
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [creditsNeeded, setCreditsNeeded] = useState(1);
  
  // Filter state
  const [showOnlyLiked, setShowOnlyLiked] = useState(false);

  // CRITICAL: Track which queue IDs we created via optimistic UI
  // Realtime will ONLY update items in this Set, never create new ones
  const optimisticQueueIdsRef = useRef<Set<string>>(new Set());
  
  // Track queue ID -> image ID mapping (for bridging optimistic items to real results)
  const queueToImageMapRef = useRef<Map<string, string>>(new Map());

  // Track pending character sheet generation (auto-loads into references when ready)
  const pendingCharacterQueueIdRef = useRef<string | null>(null);

  // No longer using credits system - all users use their own API Key
  const totalCreditCost = 0;

  // Watch for pending character sheet to finish → auto-load as reference
  useEffect(() => {
    const pendingId = pendingCharacterQueueIdRef.current;
    if (!pendingId) return;
    const item = galleryMap.get(pendingId);
    if (!item || item.status !== 'ready') return;
    const imageUrl = item.masterUrl || item.url;
    if (!imageUrl) return;
    pendingCharacterQueueIdRef.current = null;
    (async () => {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao ler imagem'));
          reader.readAsDataURL(blob);
        });
        setReferenceImages(prev => [...prev.slice(-2), base64]);
        toast.success('Personagem criado! Carregado nas referências.');
      } catch {
        toast.error('Erro ao carregar personagem nas referências');
      }
    })();
  }, [galleryMap]);

  // Convert Map to sorted array for rendering (with optional filter)
  const galleryItems = useMemo(() => {
    let items = Array.from(galleryMap.values());
    
    // Apply liked filter if active
    if (showOnlyLiked) {
      items = items.filter(item => item.liked);
    }
    
    return items.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [galleryMap, tick, showOnlyLiked]); // tick dependency forces re-render for timer updates

  // Tick interval for real-time timer updates (1 second)
  useEffect(() => {
    const hasActiveItems = galleryItems.some(
      item => item.status === 'pending' || item.status === 'generating'
    );

    if (!hasActiveItems) return;

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [galleryItems]);

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Auto-queue single grid image (6 angles) from Storyboard
  useEffect(() => {
    if (!user?.id) return;
    const raw = localStorage.getItem('abrahub_pending_grid_image');
    if (!raw) return;
    localStorage.removeItem('abrahub_pending_grid_image');
    let parsed: { imageUrl: string; aspectRatio?: string } | null = null;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed?.imageUrl) return;
    const { imageUrl, aspectRatio: srcRatio } = parsed;

    const GRID_PROMPT =
      'Create a single composite image divided into a 2-column × 3-row grid. ' +
      'Each of the 6 panels shows the exact same scene from a different camera angle, ' +
      'maintaining identical lighting, color palette, atmosphere, and subject throughout. ' +
      'Panel layout: (1) wide establishing shot — front, (2) medium shot — slightly elevated, ' +
      '(3) close-up detail — front, (4) low angle — looking up, ' +
      '(5) bird\'s eye view — top-down, (6) side profile — lateral view. ' +
      'Clean panel borders, consistent proportions, no text, no labels.';

    const ratio = srcRatio || '16:9';

    (async () => {
      try {
        toast.info('Preparando Grid...');
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Falha ao ler imagem'));
          reader.readAsDataURL(blob);
        });

        const tempId = `temp-grid-${Date.now()}`;
        const createdAt = new Date().toISOString();
        setGalleryMap(prev => {
          const newMap = new Map(prev);
          newMap.set(tempId, {
            id: tempId, type: 'image', url: undefined,
            prompt: GRID_PROMPT,
            model: 'gemini-2.0-flash-exp',
            modelLabel: 'Grid 6 ângulos • Processando...',
            status: 'pending', createdAt, creditsCost: 0,
            is_story6: true,
          });
          return newMap;
        });
        optimisticQueueIdsRef.current.add(tempId);

        const result = await queueGeneration({
          prompt: GRID_PROMPT,
          aspectRatio: ratio,
          quality: '2K',
          presetId: selectedPreset,
          focalLength: selectedFocalLength,
          aperture: selectedAperture,
          referenceImages: [base64],
          useOwnKey: true,
          storyboard6Mode: true,
        });

        if (result?.success && result?.queueId) {
          setGalleryMap(prev => {
            const newMap = new Map(prev);
            const item = newMap.get(tempId);
            if (item) {
              newMap.delete(tempId);
              optimisticQueueIdsRef.current.delete(tempId);
              newMap.set(result.queueId, { ...item, id: result.queueId, status: 'generating' });
              optimisticQueueIdsRef.current.add(result.queueId);
            }
            return newMap;
          });
          toast.success('Grid adicionado à fila!');
        } else {
          setGalleryMap(prev => { const m = new Map(prev); m.delete(tempId); return m; });
          optimisticQueueIdsRef.current.delete(tempId);
          toast.error('Erro ao enfileirar Grid');
        }
      } catch (err) {
        console.error('[PendingGrid]', err);
        toast.error('Erro ao processar Grid do Storyboard');
      }
    })();
  }, [user?.id]);

  // Check if user has a valid BYOK API key
  useEffect(() => {
    if (!user?.id) return;
    
    const checkApiKey = async () => {
      setIsCheckingApiKey(true);
      // Fetch both API key status and entitlements in parallel to avoid multiple re-renders
      const [apiKeyResult, entitlementResult] = await Promise.all([
        supabase
          .from('user_api_keys')
          .select('is_valid')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('entitlements')
          .select('plan')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      const valid = apiKeyResult.data?.is_valid === true;
      const plan = entitlementResult.data?.plan || 'free';
      
      setHasValidApiKey(valid);
      // BYOK as default when valid key exists
      setUseOwnKey(valid);
      
      // SHOW onboarding popup ONLY if:
      // 1. Key is NOT valid
      // 2. User hasn't dismissed onboarding yet
      // 3. User is NOT on FREE plan (Pro, ProPlus, Community should see it)
      if (!valid && !localStorage.getItem('byok_onboarding_seen')) {
        const eligiblePlans = ['pro', 'proplus', 'community'];
        if (eligiblePlans.includes(plan)) {
          // Delaying slightly to ensure UI is settled and avoid the flash
          setTimeout(() => setShowOnboarding(true), 500);
        } else {
          // Others: skip onboarding permanently
          localStorage.setItem('byok_onboarding_seen', 'true');
        }
      }
      setIsCheckingApiKey(false);
    };
    
    checkApiKey();
  }, [user?.id]);

  // Helper: upsert a single item into the map
  const upsertItem = useCallback((item: GalleryItem) => {
    setGalleryMap(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(item.id);
      
      if (existing) {
        // Merge: keep existing data, update with new (prefer new url/status if available)
        newMap.set(item.id, {
          ...existing,
          ...item,
          url: item.url || existing.url,
          masterUrl: item.masterUrl || existing.masterUrl,
        });
      } else {
        newMap.set(item.id, item);
      }
      
      return newMap;
    });
  }, []);

  // Helper: remove an item from the map
  const removeItem = useCallback((id: string) => {
    setGalleryMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  // RULE 4: Fetch gallery items - ONLY load completed images, NOT queue items
  // Queue items only exist if created via handleGenerate in this session
  const fetchGalleryItems = useCallback(async () => {
    if (!user?.id) return;

    try {
      // ONLY fetch completed/errored images - NO queue items!
      const { data: imagesData, error: imagesError } = await supabase
        .from('user_generated_images')
        .select('*')
        .eq('user_id', user.id)
        .neq('model', 'upload')
        .order('created_at', { ascending: false })
        .limit(100);

      if (imagesError) throw imagesError;

      // Build map from completed images ONLY, filtering out expired or broken ones
      const newMap = new Map<string, GalleryItem>();

      (imagesData || [])
        .filter(img => !isExpired(img.created_at, 30))
        .filter(img => img.status === 'generating' || img.master_url || img.url)
        .forEach((img) => {
          const imageUrl = img.master_url || img.url || undefined;
          newMap.set(img.id, {
            id: img.id,
            type: 'image' as const,
            url: imageUrl,
            masterUrl: imageUrl,
            thumbnailUrl: imageUrl,
            prompt: img.prompt,
            model: img.model,
            modelLabel: img.model_label || 'ABRAhub Realism',
            status: img.status as GalleryItem['status'],
            errorMessage: img.error_message || undefined,
            createdAt: img.created_at,
            creditsCost: img.credits_cost,
            liked: img.liked || false,
            is_story6: img.is_story6 || false,
            masterWidth: img.master_width || undefined,
            masterHeight: img.master_height || undefined,
            masterBytes: img.master_bytes || undefined,
          });
        });

      // PRESERVE existing optimistic queue items (created via handleGenerate)
      // This ensures navigating away and back doesn't lose active generations
      setGalleryMap(prev => {
        for (const [id, item] of prev.entries()) {
          if (optimisticQueueIdsRef.current.has(id) && !newMap.has(id)) {
            newMap.set(id, item);
          }
        }
        return newMap;
      });
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setIsLoadingGallery(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchGalleryItems();
  }, [fetchGalleryItems]);

  // Real-time subscription for gallery updates (both images and queue)
  useEffect(() => {
    if (!user?.id) return;

    console.log('[Realtime] Setting up subscription for user:', user.id);

    const channel = supabase
      .channel(`studio-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_generated_images',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime][user_generated_images]', payload.eventType, 'status:', (payload.new as any)?.status);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const img = payload.new as any;
            
            // IGNORE generating status from backend - we already have an optimistic card
            if (img.status === 'generating') {
              console.log('[Realtime][user_generated_images] IGNORING generating status:', img.id);
              return;
            }
            
            // RULE 3: Remove matching queue item and insert real image atomically
            setGalleryMap(prev => {
              const newMap = new Map(prev);

              // Priority 1: direct queue→image mapping (populated when queue marks completed)
              let queueIdToRemove: string | null = null;
              for (const [queueId, imageId] of queueToImageMapRef.current.entries()) {
                if (imageId === img.id) {
                  queueIdToRemove = queueId;
                  break;
                }
              }

              // Priority 2: match by prompt — each split panel has a unique ordinal prompt,
              // so this is safe even when multiple panels finish concurrently.
              // Avoids the old "grab any queue ID" fallback that caused wrong-panel swaps.
              if (!queueIdToRemove && img.prompt) {
                for (const [id, item] of newMap.entries()) {
                  if (optimisticQueueIdsRef.current.has(id) && item.prompt === img.prompt) {
                    queueIdToRemove = id;
                    break;
                  }
                }
              }

              if (queueIdToRemove) {
                console.log('[Realtime] Removing queue item', queueIdToRemove, 'replaced by image', img.id);
                newMap.delete(queueIdToRemove);
                optimisticQueueIdsRef.current.delete(queueIdToRemove);
                queueToImageMapRef.current.delete(queueIdToRemove);
              }

              // Add/update the real image — preserve existing URLs if payload lacks them
              const existing = newMap.get(img.id);
              const realtimeUrl = img.master_url || img.url || existing?.url || undefined;
              newMap.set(img.id, {
                id: img.id,
                type: 'image',
                url: realtimeUrl,
                masterUrl: realtimeUrl,
                thumbnailUrl: realtimeUrl,
                prompt: img.prompt || existing?.prompt || '',
                model: img.model || existing?.model || '',
                modelLabel: img.model_label || existing?.modelLabel || 'ABRAhub Realism',
                status: (img.status as GalleryItem['status']) || existing?.status,
                errorMessage: img.error_message || existing?.errorMessage || undefined,
                createdAt: img.created_at || existing?.createdAt || new Date().toISOString(),
                creditsCost: img.credits_cost ?? existing?.creditsCost ?? 0,
                liked: img.liked ?? existing?.liked ?? false,
                is_story6: img.is_story6 ?? existing?.is_story6 ?? false,
                masterWidth: img.master_width || existing?.masterWidth || undefined,
                masterHeight: img.master_height || existing?.masterHeight || undefined,
                masterBytes: img.master_bytes || existing?.masterBytes || undefined,
              });

              return newMap;
            });
            
            // When ready, refetch credits
            if (img.status === 'ready') {
              refetchCredits();
            }
          } else if (payload.eventType === 'DELETE') {
            removeItem((payload.old as any).id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_queue',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const q = payload.new as any;
          const queueId = q?.id || (payload.old as any)?.id;
          
          console.log('[Realtime][generation_queue]', payload.eventType, 'id:', queueId, 'status:', q?.status);
          
          // RULE 2: Realtime NEVER creates items - only updates or removes
          
          if (payload.eventType === 'DELETE') {
            // Only remove if it exists in our optimistic set
            if (optimisticQueueIdsRef.current.has((payload.old as any).id)) {
              removeItem((payload.old as any).id);
              optimisticQueueIdsRef.current.delete((payload.old as any).id);
            }
            return;
          }
          
          // RULE 6: If item doesn't exist in galleryMap, IGNORE completely
          setGalleryMap(prev => {
            if (!prev.has(q.id)) {
              console.log('[Realtime][generation_queue] IGNORING - not in galleryMap:', q.id);
              return prev; // NEVER create - just return unchanged
            }
            
            // Item exists - we can update it
            
            // If completed with result_image_id, keep placeholder and fetch image for atomic swap
            if (q.status === 'completed' && q.result_image_id) {
              console.log('[Realtime] Queue completed, keeping placeholder and fetching image', q.id, '->', q.result_image_id);
              queueToImageMapRef.current.set(q.id, q.result_image_id);
              const newMap = new Map(prev);
              const existing = newMap.get(q.id)!;
              // Keep the card visible as "ready" placeholder while we fetch the real image
              newMap.set(q.id, { ...existing, status: 'ready' as any });
              
              // Fire-and-forget: fetch the real image and do atomic swap
              const resultImageId = q.result_image_id;
              const queueId = q.id;
              supabase
                .from('user_generated_images')
                .select('*')
                .eq('id', resultImageId)
                .single()
                .then(({ data: img }) => {
                  if (img) {
                    console.log('[Realtime] Atomic swap: removing queue', queueId, 'inserting image', img.id);
                    setGalleryMap(prevMap => {
                      const swapMap = new Map(prevMap);
                      swapMap.delete(queueId);
                      optimisticQueueIdsRef.current.delete(queueId);
                      const swapUrl = img.master_url || img.url || undefined;
                      swapMap.set(img.id, {
                        id: img.id,
                        type: 'image',
                        url: swapUrl,
                        masterUrl: swapUrl,
                        thumbnailUrl: swapUrl,
                        prompt: img.prompt,
                        model: img.model,
                        modelLabel: img.model_label || 'ABRAhub Realism',
                        status: img.status as GalleryItem['status'],
                        errorMessage: img.error_message || undefined,
                        createdAt: img.created_at,
                        creditsCost: img.credits_cost,
                        liked: img.liked ?? false,
                        is_story6: img.is_story6 ?? false,
                      });
                      return swapMap;
                    });
                  }
                });
              
              return newMap;
            }
            
            // If just completed without result_image_id, remove
            if (q.status === 'completed') {
              const newMap = new Map(prev);
              newMap.delete(q.id);
              optimisticQueueIdsRef.current.delete(q.id);
              return newMap;
            }
            
            // UPDATE existing item status - never create
            const newMap = new Map(prev);
            const existing = newMap.get(q.id)!;
            newMap.set(q.id, {
              ...existing,
              status: q.status === 'failed' ? 'error' : 'generating',
              errorMessage: q.error_message || undefined,
            });
            return newMap;
          });
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, upsertItem, removeItem, refetchCredits]);

  // RULE 5: Fallback polling - NEVER creates, only detects completed and fetches images
  useEffect(() => {
    const hasActiveItems = galleryItems.some(
      item => item.status === 'pending' || item.status === 'generating'
    );

    if (!hasActiveItems || !user?.id) return;

    const pollInterval = setInterval(async () => {
      console.log('[Polling] Checking for updates...');
      
      // Get list of our optimistic queue IDs that are still active
      const activeQueueIds = Array.from(optimisticQueueIdsRef.current);
      if (activeQueueIds.length === 0) return;
      
      // Check status of our active queue items
      const { data: queueData } = await supabase
        .from('generation_queue')
        .select('id, status, result_image_id')
        .in('id', activeQueueIds);
      
      for (const q of queueData || []) {
        // RULE 5: Only detect completed, never create
        if (q.status === 'completed' && q.result_image_id) {
          console.log('[Polling] Detected completed:', q.id, '->', q.result_image_id);
          
          // Fetch the actual image
          const { data: img } = await supabase
            .from('user_generated_images')
            .select('*')
            .eq('id', q.result_image_id)
            .single();
          
          if (img) {
            // Atomic update: remove queue, add image
            setGalleryMap(prev => {
              const newMap = new Map(prev);
              newMap.delete(q.id); // Remove queue item
              optimisticQueueIdsRef.current.delete(q.id);
              
              newMap.set(img.id, {
                id: img.id,
                type: 'image',
                url: img.master_url || img.url || undefined,
                masterUrl: img.master_url || img.url || undefined,
                thumbnailUrl: img.master_url || img.url || undefined,
                prompt: img.prompt,
                model: img.model,
                modelLabel: img.model_label || 'ABRAhub Realism',
                status: img.status as GalleryItem['status'],
                errorMessage: img.error_message || undefined,
                createdAt: img.created_at,
                creditsCost: img.credits_cost,
                liked: img.liked ?? false,
                is_story6: img.is_story6 ?? false,
              });
              return newMap;
            });
          }
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [galleryItems, user?.id]);

  const GRID_DEFAULT_PROMPT =
    'Create a single composite image divided into a 2-column × 3-row grid. ' +
    'Each of the 6 panels shows the exact same scene from a different camera angle, ' +
    'maintaining identical lighting, color palette, atmosphere, and subject throughout. ' +
    'Panel layout: (1) wide establishing shot — front, (2) medium shot — slightly elevated, ' +
    "(3) close-up detail — front, (4) low angle — looking up, " +
    "(5) bird's eye view — top-down, (6) side profile — lateral view. " +
    'Clean panel borders, consistent proportions, no text, no labels.';

  // RULE 1: handleGenerate is the ONLY place that creates GalleryItems
  // Batch size 1-4 supported - each generates exactly 1 card
  // CONCURRENT GENERATIONS: User can trigger multiple generations without waiting
  const handleGenerate = async () => {
    const isGridWithRef = storyboard6Mode && referenceImages.length > 0;
    if (!prompt.trim() && !isGridWithRef) {
      toast.error('Digite uma descrição da cena');
      return;
    }

    // Capture current BYOK and sequence state
    const currentUseOwnKey = true; // Forced for community version
    const currentSequenceMode = sequenceMode;
    const currentSequenceKeepCharacter = sequenceKeepCharacter;
    const currentSequenceKeepScenery = sequenceKeepScenery;
    const currentStoryboard6Mode = storyboard6Mode;

    // Capture current values BEFORE clearing
    // Grid mode with no text → inject default multi-angle prompt
    const currentPrompt = (isGridWithRef && !prompt.trim()) ? GRID_DEFAULT_PROMPT : prompt;
    const currentBatchSize = batchSize;
    const currentAspectRatio = aspectRatio;
    const currentQuality = quality;
    const currentPreset = selectedPreset;
    const currentAngle = selectedAngle;
    const currentFocalLength = selectedFocalLength;
    const currentAperture = selectedAperture;
    const currentFilmLook = selectedFilmLook;
    const currentReferenceImages = [...referenceImages];

    // Clear form IMMEDIATELY - allows user to start new generation
    setPrompt('');
    setReferenceImages([]);
    
    // Brief visual feedback (500ms) to prevent accidental double-clicks
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 500);

    // OPTIMISTIC UI: Create temporary cards IMMEDIATELY for instant feedback
    const tempIds: string[] = [];
    const createdAt = new Date().toISOString();
    
    for (let i = 0; i < currentBatchSize; i++) {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`;
      tempIds.push(tempId);
      
      // Create instant card with "pending" status
      const instantItem: GalleryItem = {
        id: tempId,
        type: 'image',
        url: undefined,
        prompt: currentPrompt,
        model: 'gemini-2.0-flash-exp',
        modelLabel: currentPreset || 'ABRAhub Realism',
        status: 'pending', // Shows "Processando..."
        createdAt,
        creditsCost: 0,
      };
      
      // Card appears INSTANTLY in gallery
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        newMap.set(tempId, instantItem);
        return newMap;
      });

      // REGRA CRÍTICA: Adicionar ao Ref IMEDIATAMENTE para que fetchGalleryItems não remova o card
      optimisticQueueIdsRef.current.add(tempId);
    }

    // Process API calls in background - don't await, user can continue
    (async () => {
      try {
        // Generate batch (1-4 images)
        const promises: Promise<any>[] = [];
        
        for (let i = 0; i < currentBatchSize; i++) {
          promises.push(
            queueGeneration({
              prompt: currentPrompt,
              aspectRatio: currentAspectRatio,
              quality: currentQuality,
              presetId: currentPreset,
              cameraAngle: currentAngle,
              focalLength: currentFocalLength,
              aperture: currentAperture,
              filmLook: currentFilmLook || null,
              referenceImages: currentReferenceImages.length > 0 ? currentReferenceImages : undefined,
              useOwnKey: currentUseOwnKey,
              sequenceMode: currentSequenceMode,
              sequenceKeepCharacter: currentSequenceKeepCharacter,
              sequenceKeepScenery: currentSequenceKeepScenery,
              storyboard6Mode: currentStoryboard6Mode,
            })
          );
        }
        
        // Process all queue results
        const results = await Promise.allSettled(promises);
        
        let successCount = 0;
        
        results.forEach((result, index) => {
          const tempId = tempIds[index];
          
          if (result.status === 'fulfilled' && result.value?.success) {
            const data = result.value;
            const queueId = data.queueId;
            
            // ATOMIC SWAP: Replace tempId with real queueId to enable Realtime updates
            setGalleryMap(prev => {
              const newMap = new Map(prev);
              const tempItem = newMap.get(tempId);
              
              if (tempItem && queueId) {
                // Remove temp card and insert real queue card with same data
                newMap.delete(tempId);
                optimisticQueueIdsRef.current.delete(tempId);
                
                newMap.set(queueId, {
                  ...tempItem,
                  id: queueId,
                  status: 'generating', // Server has it now
                });
                
                // Track the real queueId
                optimisticQueueIdsRef.current.add(queueId);
              }
              return newMap;
            });
            
            successCount++;
          } else {
            // API failed - update temp card to error state
            const queueError = result as any;
            const errorMessage = queueError?.apiError?.message || 
                                 queueError?.message || 
                                 'Falha ao enviar para fila';
            
            console.error(`[handleGenerate] Batch item ${index + 1} failed:`, {
              error: result,
              apiError: queueError?.apiError,
              suggestedAction: queueError?.suggestedAction,
            });
            
            setGalleryMap(prev => {
              const newMap = new Map(prev);
              const tempItem = newMap.get(tempId);
              
              if (tempItem) {
                newMap.set(tempId, {
                  ...tempItem,
                  status: 'error',
                  errorMessage,
                });
              }
              
              return newMap;
            });
          }
        });
        
        if (successCount > 0) {
          toast.success(`${successCount} ${successCount === 1 ? 'imagem adicionada' : 'imagens adicionadas'} à fila!`);
          
          // Fire-and-forget: trigger worker to start processing
          supabase.functions.invoke('process-generation-queue').catch(err => {
            console.log('[Worker trigger] Error (non-blocking):', err);
          });
        }
        
        // Refetch queue status and credits
        refetchQueue();
        refetchCredits();
        
      } catch (error) {
        // Enhanced error handling with specific messages
        const queueError = error as any;
        const errorMessage = queueError?.apiError?.message || 
                             (error instanceof Error ? error.message : 'Erro ao adicionar à fila');
        const suggestedAction = queueError?.suggestedAction;
        
        console.error('[handleGenerate] Queue error:', {
          error,
          apiError: queueError?.apiError,
          suggestedAction,
          timestamp: new Date().toISOString(),
        });
        
        // Show appropriate toast based on error type
        if (suggestedAction === 'login') {
          toast.error(errorMessage, {
            action: {
              label: 'Fazer login',
              onClick: () => window.location.reload(),
            },
          });
        } else if (suggestedAction === 'retry') {
          toast.error(errorMessage, {
            action: {
              label: 'Tentar novamente',
              onClick: () => handleGenerate(),
            },
          });
        } else {
          toast.error(errorMessage);
        }
        
        // Mark all temp items as error with specific message
        tempIds.forEach(tempId => {
          setGalleryMap(prev => {
            const newMap = new Map(prev);
            const tempItem = newMap.get(tempId);
            if (tempItem) {
              newMap.set(tempId, {
                ...tempItem,
                status: 'error',
                errorMessage,
              });
            }
            return newMap;
          });
        });
      }
    })();
  };

  // Unified delete function - permanently removes from ALL tables via edge function
  const handleDelete = async (id: string) => {
    try {
      // Remove from UI immediately (optimistic update)
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
      // Use edge function to delete from BOTH tables with service role
      const { data, error } = await supabase.functions.invoke('queue-image-generation', {
        body: { action: 'cancel', queueId: id },
      });

      // Fallback: Se a Edge Function falhar, tentar deletar diretamente da tabela de imagens
      if (error) {
        console.warn('Edge Function cancel failed, trying direct delete...', error);
        await supabase.from('user_generated_images').delete().eq('id', id);
      }

      toast.success('Removido permanentemente');
      refetchQueue();
    } catch (error) {
      console.error('Delete error:', error);
      // Refetch to sync with real state
      fetchGalleryItems();
      toast.error('Erro ao remover');
    }
  };

  // Alias for compatibility - both use the same unified delete
  const handleCancelQueue = handleDelete;

  // Handle retry (re-queue a failed/timeout generation)
  const handleRetry = async (item: GalleryItem) => {
    try {
      // Remove the failed item from UI immediately
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(item.id);
        return newMap;
      });

      // First, remove the failed item using unified delete
      await supabase.functions.invoke('queue-image-generation', {
        body: { action: 'cancel', queueId: item.id },
      });

      // Re-queue the generation with same prompt (preserve BYOK setting)
      await queueGeneration({
        prompt: item.prompt,
        aspectRatio: aspectRatio, // Use current settings
        quality: quality,
        presetId: selectedPreset,
        focalLength: selectedFocalLength,
        aperture: selectedAperture,
        useOwnKey: useOwnKey,
      });

      toast.success('Geração reenviada para a fila!');
      refetchQueue();
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Erro ao reenviar geração');
      // Refetch to sync state
      fetchGalleryItems();
    }
  };

  // Handle toggle like on an image
  const handleToggleLike = async (id: string, liked: boolean) => {
    try {
      // Optimistic update
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, liked });
        }
        return newMap;
      });

      // Update in database
      const { error } = await supabase
        .from('user_generated_images')
        .update({ liked })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Like error:', error);
      // Revert on error
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, liked: !liked });
        }
        return newMap;
      });
      toast.error('Erro ao atualizar favorito');
    }
  };

  // Add gallery image as reference in the generation form
  const handleAddAsReference = async (item: GalleryItem) => {
    const imageUrl = item.masterUrl || item.url;
    if (!imageUrl) return;
    try {
      toast.info('Carregando como referência...');
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler imagem'));
        reader.readAsDataURL(blob);
      });
      setReferenceImages(prev => [...prev.slice(-2), base64]); // max 3 refs
      toast.success('Imagem adicionada como referência!');
    } catch {
      toast.error('Erro ao carregar referência');
    }
  };

  const CHARACTER_SHEET_PROMPT = `Create a full professional character sheet of the same person.

Maintain identical facial features, hairstyle, skin texture, and clothing.

Generate the following views in a clean studio setting with neutral soft lighting and a plain light background:

1. Full body – front view
2. Full body – left profile
3. Full body – right profile
4. Full body – back view
5. Close-up – front portrait
6. Close-up – left profile
7. Close-up – right profile

Neutral expression. Arms relaxed at sides. No stylization. No dramatic lighting. No pose changes. No outfit changes.

Highly detailed, sharp focus, consistent proportions across all views.`;

  const handleCreateCharacterSheet = async (item: GalleryItem) => {
    const imageUrl = item.masterUrl || item.url;
    if (!imageUrl) return;
    try {
      toast.info('Preparando personagem...');
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler imagem'));
        reader.readAsDataURL(blob);
      });

      const tempId = `temp-char-${Date.now()}`;
      const createdAt = new Date().toISOString();
      setGalleryMap(prev => {
        const newMap = new Map(prev);
        newMap.set(tempId, {
          id: tempId, type: 'image', url: undefined,
          prompt: CHARACTER_SHEET_PROMPT,
          model: 'gemini-2.0-flash-exp',
          modelLabel: 'Personagem • Processando...',
          status: 'pending', createdAt, creditsCost: 0,
        });
        return newMap;
      });
      optimisticQueueIdsRef.current.add(tempId);

      const result = await queueGeneration({
        prompt: CHARACTER_SHEET_PROMPT,
        aspectRatio: '16:9',
        quality: '2K',
        presetId: selectedPreset,
        focalLength: selectedFocalLength,
        aperture: selectedAperture,
        referenceImages: [base64],
        useOwnKey: true,
      });

      if (result?.success && result?.queueId) {
        setGalleryMap(prev => {
          const newMap = new Map(prev);
          const tempItem = newMap.get(tempId);
          if (tempItem) {
            newMap.delete(tempId);
            optimisticQueueIdsRef.current.delete(tempId);
            newMap.set(result.queueId, { ...tempItem, id: result.queueId, status: 'generating' });
            optimisticQueueIdsRef.current.add(result.queueId);
          }
          return newMap;
        });
        pendingCharacterQueueIdRef.current = result.queueId;
        toast.success('Gerando personagem... será carregado nas referências ao concluir.');
      }
    } catch {
      toast.error('Erro ao criar personagem');
    }
  };

  // Handle edit (create variation) - loads image as reference and converts to base64
  const handleEdit = async (item: GalleryItem) => {
    if (!item.url && !item.masterUrl) {
      toast.error('Imagem não disponível para variação');
      return;
    }

    const imageUrl = item.masterUrl || item.url;
    if (!imageUrl) return;

    try {
      toast.info('Carregando imagem como referência...');
      
      // Fetch the image and convert to base64
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Falha ao ler imagem'));
        reader.readAsDataURL(blob);
      });
      
      // Set as reference (in base64 format)
      setReferenceImages([base64]);
      setPrompt(`Variação: ${item.prompt}`);
      toast.success('Imagem carregada! Edite o prompt e clique em GENERATE.');
    } catch (error) {
      console.error('Error loading image for edit:', error);
      toast.error('Erro ao carregar imagem para edição');
    }
  };

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      {!hasValidApiKey && !authLoading && !isCheckingApiKey && (
        <button
          onClick={() => setShowOnboarding(true)}
          className="w-full bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top duration-500 hover:bg-yellow-500/20 transition-colors cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-xs font-medium text-yellow-500 text-center">
            Configure aqui sua <strong>API Key</strong> para gerar cenas cinematográficas →
          </p>
        </button>
      )}

      <main className="pb-32">
        <div className="container px-4 py-6 md:px-6">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowOnlyLiked(!showOnlyLiked)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showOnlyLiked 
                  ? 'bg-pink-600 text-white' 
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
              }`}
            >
              <Heart className={`h-4 w-4 ${showOnlyLiked ? 'fill-current' : ''}`} />
              Curtidas
            </button>
          </div>
          
          {isLoadingGallery ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <Sparkles className="h-8 w-8 animate-pulse text-primary" />
              <p className="text-muted-foreground">Carregando galeria...</p>
            </div>
          ) : (
            <GalleryGrid
              items={galleryItems}
              onDelete={handleDelete}
              onCancelQueue={handleCancelQueue}
              onRetry={handleRetry}
              onEdit={handleEdit}
              onAddAsReference={handleAddAsReference}
              onCreateCharacterSheet={handleCreateCharacterSheet}
              onToggleLike={handleToggleLike}
              onRefresh={fetchGalleryItems}
              emptyMessage={showOnlyLiked ? "Nenhuma imagem curtida ainda" : "Suas fotos cinematográficas aparecerão aqui"}
              emptyIcon={showOnlyLiked ? <Heart className="h-10 w-10 text-pink-500/50" /> : <ImageIcon className="h-10 w-10 text-primary/50" />}
              showExpiration={true}
              expirationDays={30}
              isPro={credits.total >= 100}
              setGalleryMap={setGalleryMap}
              optimisticQueueIdsRef={optimisticQueueIdsRef}
            />
          )}
        </div>
      </main>

      <QueueStatusBar items={activeItems} />

      <RealismFloatingBar
        prompt={prompt}
        onPromptChange={setPrompt}
        selectedAspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        selectedPreset={selectedPreset}
        selectedAngle={selectedAngle}
        selectedFocalLength={selectedFocalLength}
        selectedAperture={selectedAperture}
        onPresetChange={setSelectedPreset}
        onAngleChange={setSelectedAngle}
        onFocalLengthChange={setSelectedFocalLength}
        onApertureChange={setSelectedAperture}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        creditCost={0}
        availableCredits={999}
        referenceImages={referenceImages}
        onReferenceImagesChange={setReferenceImages}
        batchSize={batchSize}
        onBatchSizeChange={setBatchSize}
        selectedQuality={quality}
        onQualityChange={setQuality}
        selectedFilmLook={selectedFilmLook}
        onFilmLookChange={setSelectedFilmLook}
        useOwnKey={true}
        onUseOwnKeyChange={() => {}}
        hasValidApiKey={hasValidApiKey}
        sequenceMode={sequenceMode}
        onSequenceModeChange={setSequenceMode}
        sequenceKeepCharacter={sequenceKeepCharacter}
        onSequenceKeepCharacterChange={setSequenceKeepCharacter}
        sequenceKeepScenery={sequenceKeepScenery}
        onSequenceKeepSceneryChange={setSequenceKeepScenery}
        storyboard6Mode={storyboard6Mode}
        onStoryboard6ModeChange={setStoryboard6Mode}
      />

      <ApiKeyOnboardingModal
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onKeyValidated={() => {
          setHasValidApiKey(true);
        }}
      />
    </div>
  );
}
