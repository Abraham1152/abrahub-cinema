import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface StoryboardProject {
  id: string;
  user_id: string;
  title: string;
  canvas_state: { zoom: number; panX: number; panY: number };
  created_at: string;
  updated_at: string;
}

export interface StoryboardScene {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string | null;
  prompt_base: string | null;
  aspect_ratio: string;
  style_data: Record<string, any>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  sort_order: number;
  parent_scene_id: string | null;
  inherit_style: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoryboardSceneImage {
  id: string;
  scene_id: string;
  user_id: string;
  image_id: string | null;
  image_url: string | null;
  master_url: string | null;
  prompt: string | null;
  role: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface SceneReference {
  id: string;
  scene_id: string;
  image_id: string;
  user_id: string;
  sort_order: number;
  created_at: string;
  // joined
  preview_url?: string | null;
  prompt?: string | null;
}

export interface SceneConnection {
  id: string;
  from_scene_id: string;
  to_scene_id: string;
  user_id: string;
  created_at: string;
}

export function useStoryboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<StoryboardProject[]>([]);
  const [currentProject, setCurrentProject] = useState<StoryboardProject | null>(null);
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [sceneImages, setSceneImages] = useState<Record<string, StoryboardSceneImage[]>>({});
  const [sceneReferences, setSceneReferences] = useState<Record<string, SceneReference[]>>({});
  const [connections, setConnections] = useState<SceneConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [generatingScenes, setGeneratingScenes] = useState<Set<string>>(new Set());

  // Check BYOK (optional - for passing useOwnKey to Studio pipeline)
  const checkApiKey = useCallback(async () => {
    if (!user) { setHasApiKey(false); return; }
    const { data } = await supabase
      .from('user_api_keys')
      .select('is_valid')
      .eq('user_id', user.id)
      .maybeSingle();
    setHasApiKey(data?.is_valid === true);
  }, [user]);

  useEffect(() => { checkApiKey(); }, [checkApiKey]);

  // Load projects
  const loadProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('storyboard_projects')
      .select('*')
      .order('updated_at', { ascending: false }) as any;
    setProjects(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Create project
  const createProject = async (title = 'Novo Storyboard') => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('storyboard_projects')
      .insert({ user_id: user.id, title })
      .select()
      .single() as any;
    if (error) { toast.error('Erro ao criar projeto'); return null; }
    setProjects(prev => [data, ...prev]);
    return data as StoryboardProject;
  };

  // Select project & load scenes, images, references, connections
  const selectProject = useCallback(async (project: StoryboardProject) => {
    setCurrentProject(project);
    const { data: scenesData } = await supabase
      .from('storyboard_scenes')
      .select('*')
      .eq('project_id', project.id)
      .order('sort_order') as any;
    const loadedScenes = (scenesData || []) as StoryboardScene[];
    setScenes(loadedScenes);

    if (loadedScenes.length > 0) {
      const sceneIds = loadedScenes.map(s => s.id);

      // Load images, references, connections in parallel
      const [imagesRes, refsRes, connsRes] = await Promise.all([
        supabase
          .from('storyboard_scene_images')
          .select('*')
          .in('scene_id', sceneIds)
          .order('sort_order') as any,
        supabase
          .from('storyboard_scene_references')
          .select('*, user_generated_images!inner(preview_url, master_url, url, prompt)')
          .in('scene_id', sceneIds)
          .order('sort_order') as any,
        supabase
          .from('storyboard_scene_connections')
          .select('*')
          .or(`from_scene_id.in.(${sceneIds.join(',')}),to_scene_id.in.(${sceneIds.join(',')})`) as any,
      ]);

      // Group images
      const grouped: Record<string, StoryboardSceneImage[]> = {};
      (imagesRes.data || []).forEach((img: any) => {
        if (!grouped[img.scene_id]) grouped[img.scene_id] = [];
        grouped[img.scene_id].push(img);
      });
      setSceneImages(grouped);

      // Group references
      const refsGrouped: Record<string, SceneReference[]> = {};
      (refsRes.data || []).forEach((ref: any) => {
        const imgData = ref.user_generated_images;
        const mapped: SceneReference = {
          ...ref,
          preview_url: imgData?.preview_url || imgData?.master_url || imgData?.url || null,
          prompt: imgData?.prompt,
        };
        if (!refsGrouped[ref.scene_id]) refsGrouped[ref.scene_id] = [];
        refsGrouped[ref.scene_id].push(mapped);
      });
      setSceneReferences(refsGrouped);

      setConnections(connsRes.data || []);
    } else {
      setSceneImages({});
      setSceneReferences({});
      setConnections([]);
    }
  }, []);

  // Create scene (optionally inheriting from a source scene)
  const createScene = async (fromSceneId?: string) => {
    if (!user || !currentProject) return;
    const sceneWidth = 360;
    const gap = 100;
    let maxRight = 0;
    scenes.forEach(s => {
      const right = s.position_x + sceneWidth;
      if (right > maxRight) maxRight = right;
    });
    const newX = scenes.length === 0 ? 100 : maxRight + gap;

    // Inherit from source scene
    let inheritedData: Partial<StoryboardScene> = {};
    let primaryImageForRef: StoryboardSceneImage | null = null;
    if (fromSceneId) {
      const sourceScene = scenes.find(s => s.id === fromSceneId);
      if (sourceScene) {
        inheritedData = {
          aspect_ratio: sourceScene.aspect_ratio,
          style_data: sourceScene.style_data,
        };
        // Find primary image of source scene
        const sourceImages = sceneImages[fromSceneId] || [];
        primaryImageForRef = sourceImages.find(i => i.is_primary) || null;
      }
    }

    const { data, error } = await supabase
      .from('storyboard_scenes')
      .insert({
        project_id: currentProject.id,
        user_id: user.id,
        title: `Cena ${scenes.length + 1}`,
        sort_order: scenes.length,
        position_x: newX,
        position_y: 150,
        ...inheritedData,
      })
      .select()
      .single() as any;
    if (error) { toast.error('Erro ao criar cena'); return; }
    setScenes(prev => [...prev, data]);

    // Always create connection when fromSceneId is provided
    if (fromSceneId) {
      await addConnection(fromSceneId, data.id);
      // Also add primary image as content reference if available
      if (primaryImageForRef?.image_id) {
        await addReference(data.id, primaryImageForRef.image_id, primaryImageForRef.image_url || primaryImageForRef.master_url || undefined, primaryImageForRef.prompt || undefined);
      }
    }
  };

  // Update scene (with style propagation to children)
  const updateScene = async (sceneId: string, updates: Partial<StoryboardScene>) => {
    const { error } = await supabase
      .from('storyboard_scenes')
      .update(updates)
      .eq('id', sceneId) as any;
    if (error) return;
    setScenes(prev => {
      const updated = prev.map(s => s.id === sceneId ? { ...s, ...updates } : s);
      // Propagate style_data / aspect_ratio to children with inherit_style = true
      if (updates.style_data || updates.aspect_ratio) {
        const childScenes = updated.filter(s => s.parent_scene_id === sceneId && s.inherit_style);
        const propagation: Partial<StoryboardScene> = {};
        if (updates.style_data) propagation.style_data = updates.style_data;
        if (updates.aspect_ratio) propagation.aspect_ratio = updates.aspect_ratio;
        childScenes.forEach(child => {
          supabase.from('storyboard_scenes').update(propagation).eq('id', child.id).then(() => {});
        });
        return updated.map(s => (s.parent_scene_id === sceneId && s.inherit_style) ? { ...s, ...propagation } : s);
      }
      return updated;
    });
  };

  // Delete scene
  const deleteScene = async (sceneId: string) => {
    await supabase.from('storyboard_scenes').delete().eq('id', sceneId) as any;
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    setSceneImages(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
    setSceneReferences(prev => { const n = { ...prev }; delete n[sceneId]; return n; });
    setConnections(prev => prev.filter(c => c.from_scene_id !== sceneId && c.to_scene_id !== sceneId));
  };

  // Add reference (image from gallery)
  const addReference = async (sceneId: string, imageId: string, previewUrl?: string, prompt?: string) => {
    if (!user) return;
    const currentRefs = sceneReferences[sceneId] || [];
    if (currentRefs.length >= 3) {
      toast.error('Máximo de 3 referências por cena');
      return;
    }
    // Check duplicate
    if (currentRefs.some(r => r.image_id === imageId)) {
      toast.error('Referência já adicionada');
      return;
    }
    const { data, error } = await supabase
      .from('storyboard_scene_references')
      .insert({
        scene_id: sceneId,
        image_id: imageId,
        user_id: user.id,
        sort_order: currentRefs.length,
      })
      .select()
      .single() as any;
    if (error) { toast.error('Erro ao adicionar referência'); return; }
    const ref: SceneReference = { ...data, preview_url: previewUrl, prompt };
    setSceneReferences(prev => ({
      ...prev,
      [sceneId]: [...(prev[sceneId] || []), ref],
    }));
  };

  // Upload file from PC and add as reference
  const uploadFileAsReference = async (sceneId: string, file: File) => {
    if (!user) return;
    const currentRefs = sceneReferences[sceneId] || [];
    if (currentRefs.length >= 3) {
      toast.error('Máximo de 3 referências por cena');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 10MB)');
      return;
    }

    const ext = file.name.split('.').pop() || 'png';
    const path = `${user.id}/ref-${Date.now()}.${ext}`;

    // Upload to storage
    const { error: uploadErr } = await supabase.storage
      .from('storyboard-images')
      .upload(path, file, { contentType: file.type });
    if (uploadErr) { toast.error('Erro ao fazer upload'); return; }

    const { data: urlData } = supabase.storage
      .from('storyboard-images')
      .getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Create user_generated_images entry so it can be referenced
    const { data: imgData, error: imgErr } = await supabase
      .from('user_generated_images')
      .insert({
        user_id: user.id,
        prompt: file.name,
        model: 'upload',
        status: 'ready',
        preview_url: publicUrl,
        master_url: publicUrl,
        credits_cost: 0,
      })
      .select('id')
      .single() as any;
    if (imgErr) { toast.error('Erro ao registrar imagem'); return; }

    // Add as reference
    await addReference(sceneId, imgData.id, publicUrl, file.name);
  };

  // Remove reference
  const removeReference = async (sceneId: string, refId: string) => {
    await supabase.from('storyboard_scene_references').delete().eq('id', refId) as any;
    setSceneReferences(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter(r => r.id !== refId),
    }));
  };

  // Set primary image
  const setPrimaryImage = async (sceneId: string, imageId: string) => {
    if (!user) return;
    const currentImages = sceneImages[sceneId] || [];
    // Unset all, set the one
    for (const img of currentImages) {
      if (img.is_primary && img.id !== imageId) {
        await supabase.from('storyboard_scene_images').update({ is_primary: false }).eq('id', img.id) as any;
      }
    }
    await supabase.from('storyboard_scene_images').update({ is_primary: true }).eq('id', imageId) as any;
    setSceneImages(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).map(img => ({
        ...img,
        is_primary: img.id === imageId,
      })),
    }));
  };

  // Remove image from scene
  const removeImageFromScene = async (imageId: string, sceneId: string) => {
    await supabase.from('storyboard_scene_images').delete().eq('id', imageId) as any;
    setSceneImages(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter(img => img.id !== imageId),
    }));
  };

  // Generate image in scene using the Studio queue pipeline
  const generateImage = async (sceneId: string, promptComplement?: string) => {
    if (!user) return null;
    setGeneratingScenes(prev => new Set(prev).add(sceneId));
    try {
      const scene = scenes.find(s => s.id === sceneId);
      if (!scene || !scene.prompt_base?.trim()) {
        toast.error('Prompt base é obrigatório');
        return null;
      }

      // Build prompt from scene data
      let fullPrompt = scene.prompt_base;
      if (promptComplement?.trim()) {
        fullPrompt += `\n\n${promptComplement.trim()}`;
      }

      // Extract cinema params from style_data (or use defaults)
      const styleData = scene.style_data || {};
      const presetId = (styleData as any).presetId || 'arri-natural';
      const focalLength = (styleData as any).focalLength || '35mm';
      const aperture = (styleData as any).aperture || 'f2.8';
      const cameraAngle = (styleData as any).cameraAngle || 'eye-level';
      const filmLook = (styleData as any).filmLook || null;

      // Fetch reference images as base64 for the Studio pipeline
      const refs = sceneReferences[sceneId] || [];
      const referenceImages: string[] = [];

      // Include inherited reference images as STYLE anchors only when inherit_style is ON
      const inheritedImgs = scene.inherit_style
        ? (sceneImages[sceneId] || []).filter(img => img.role === 'inherited')
        : [];
      const styleReferenceImages: string[] = [];
      for (const inhImg of inheritedImgs) {
        const url = inhImg.image_url || inhImg.master_url;
        if (url) {
          try {
            const resp = await fetch(url);
            if (resp.ok) {
              const blob = await resp.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              styleReferenceImages.push(base64);
            }
          } catch { /* skip */ }
        }
      }

      for (const ref of refs.slice(0, 3)) {
        if (ref.preview_url) {
          try {
            const resp = await fetch(ref.preview_url);
            if (resp.ok) {
              const blob = await resp.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              referenceImages.push(base64);
            }
          } catch {
            // Skip failed references
          }
        }
      }

      // Combine: style references first, then content references
      const allReferenceImages = [...styleReferenceImages, ...referenceImages];

      // Use Sequence Mode flags so the edge function applies its tested continuity prompts
      const hasStyleAnchors = styleReferenceImages.length > 0;
      const inheritCharacter = hasStyleAnchors && (scene.style_data as any)?.inherit_character !== false;
      const inheritEnvironment = hasStyleAnchors && (scene.style_data as any)?.inherit_environment !== false;

      // Call the same queue-image-generation used by Studio
      const { data, error } = await supabase.functions.invoke('queue-image-generation', {
        body: {
          prompt: fullPrompt,
          aspectRatio: scene.aspect_ratio || '16:9',
          quality: '2K' as const,
          presetId,
          focalLength,
          aperture,
          cameraAngle,
          filmLook,
          referenceImages: allReferenceImages,
          sequenceMode: hasStyleAnchors,
          sequenceKeepCharacter: inheritCharacter,
          sequenceKeepScenery: inheritEnvironment,
          useOwnKey: hasApiKey === true,
        },
      });

      if (error) {
        const errMsg = typeof error === 'object' && error.message ? error.message : 'Erro ao gerar imagem';
        toast.error(errMsg);
        return null;
      }
      if (data?.error) {
        toast.error(data.error);
        return null;
      }

      toast.success('Imagem na fila de geração');

      // Poll generation_queue for the result
      const queueId = data?.queueId;
      if (!queueId) return null;

      // Also trigger process-generation-queue
      supabase.functions.invoke('process-generation-queue', { body: {} }).catch(() => {});

      const pollForResult = async (): Promise<any> => {
        const maxAttempts = 120; // 4 min max (2s intervals)
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 2000));
          
          const { data: queueItem } = await supabase
            .from('generation_queue')
            .select('id, status, result_image_id, error_message')
            .eq('id', queueId)
            .single();

          if (!queueItem) continue;
          
          if (queueItem.status === 'completed' && queueItem.result_image_id) {
            // Fetch the generated image details
            const { data: imgData } = await supabase
              .from('user_generated_images')
              .select('id, preview_url, master_url, url')
              .eq('id', queueItem.result_image_id)
              .single();
            return imgData;
          }
          if (queueItem.status === 'failed' || queueItem.status === 'error') {
            toast.error(queueItem.error_message || 'Erro na geração');
            return null;
          }
        }
        toast.error('Tempo de geração excedido');
        return null;
      };

      const result = await pollForResult();
      if (!result) return null;

      const imageUrl = result.preview_url || result.master_url || result.url;
      const masterUrl = result.master_url || imageUrl;

      // Check if first image in scene
      const currentImages = sceneImages[sceneId] || [];
      const isPrimary = currentImages.length === 0;

      // Save to storyboard_scene_images
      const { data: sceneImgData } = await supabase
        .from('storyboard_scene_images')
        .insert({
          scene_id: sceneId,
          user_id: user.id,
          image_id: result.id,
          image_url: imageUrl,
          master_url: masterUrl,
          prompt: fullPrompt.substring(0, 2000),
          role: 'generated',
          sort_order: currentImages.length,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (sceneImgData) {
        setSceneImages(prev => ({
          ...prev,
          [sceneId]: [...(prev[sceneId] || []), sceneImgData as StoryboardSceneImage],
        }));
      }

      return { imageId: result.id, imageUrl, isPrimary };
    } catch (err) {
      console.error('[Storyboard generateImage]', err);
      toast.error(err instanceof Error ? err.message : 'Erro inesperado');
      return null;
    } finally {
      setGeneratingScenes(prev => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  };

  // Connections with visual inheritance
  const addConnection = async (fromSceneId: string, toSceneId: string) => {
    if (!user) return;
    if (fromSceneId === toSceneId) return;
    if (connections.some(c => c.from_scene_id === fromSceneId && c.to_scene_id === toSceneId)) return;
    const { data, error } = await supabase
      .from('storyboard_scene_connections')
      .insert({ from_scene_id: fromSceneId, to_scene_id: toSceneId, user_id: user.id })
      .select()
      .single() as any;
    if (error) return;
    setConnections(prev => [...prev, data]);

    // Set parent_scene_id & inherit_style on child, copy style_data & aspect_ratio
    const parentScene = scenes.find(s => s.id === fromSceneId);
    if (parentScene) {
      const inheritUpdates: any = {
        parent_scene_id: fromSceneId,
        inherit_style: true,
        style_data: { ...parentScene.style_data, inherit_character: true, inherit_environment: true },
        aspect_ratio: parentScene.aspect_ratio,
      };
      await supabase.from('storyboard_scenes').update(inheritUpdates).eq('id', toSceneId);
      setScenes(prev => prev.map(s => s.id === toSceneId ? { ...s, ...inheritUpdates } : s));

      // Insert inherited reference from parent's primary image
      const parentImages = sceneImages[fromSceneId] || [];
      const primaryImg = parentImages.find(i => i.is_primary) || parentImages[0];
      if (primaryImg?.image_id) {
        // Remove any existing inherited refs for this child first
        await supabase.from('storyboard_scene_images').delete()
          .eq('scene_id', toSceneId).eq('role', 'inherited');

        const { data: inheritedImg } = await supabase
          .from('storyboard_scene_images')
          .insert({
            scene_id: toSceneId,
            user_id: user.id,
            image_id: primaryImg.image_id,
            image_url: primaryImg.image_url,
            master_url: primaryImg.master_url,
            prompt: primaryImg.prompt,
            role: 'inherited',
            sort_order: -1,
            is_primary: false,
          })
          .select()
          .single() as any;
        if (inheritedImg) {
          setSceneImages(prev => ({
            ...prev,
            [toSceneId]: [...(prev[toSceneId] || []), inheritedImg],
          }));
        }
      }
    }
  };

  const removeConnection = async (connId: string) => {
    const conn = connections.find(c => c.id === connId);
    await supabase.from('storyboard_scene_connections').delete().eq('id', connId) as any;
    setConnections(prev => prev.filter(c => c.id !== connId));

    // Clear parent_scene_id on the child scene and remove inherited images
    if (conn) {
      await supabase.from('storyboard_scenes')
        .update({ parent_scene_id: null, inherit_style: true } as any)
        .eq('id', conn.to_scene_id);
      setScenes(prev => prev.map(s =>
        s.id === conn.to_scene_id ? { ...s, parent_scene_id: null, inherit_style: true } : s
      ));

      // Remove inherited images
      await supabase.from('storyboard_scene_images').delete()
        .eq('scene_id', conn.to_scene_id).eq('role', 'inherited');
      setSceneImages(prev => ({
        ...prev,
        [conn.to_scene_id]: (prev[conn.to_scene_id] || []).filter(img => img.role !== 'inherited'),
      }));
    }
  };

  // Change style anchor image for a scene
  const changeStyleAnchor = async (sceneId: string, imageId: string, previewUrl?: string) => {
    if (!user) return;
    // Remove existing inherited images
    await supabase.from('storyboard_scene_images').delete()
      .eq('scene_id', sceneId).eq('role', 'inherited');

    // Fetch the selected image details
    const { data: imgData } = await supabase
      .from('user_generated_images')
      .select('id, preview_url, master_url, prompt')
      .eq('id', imageId)
      .single() as any;

    const imgUrl = previewUrl || imgData?.preview_url;
    const masterUrl = imgData?.master_url;

    const { data: newInherited } = await supabase
      .from('storyboard_scene_images')
      .insert({
        scene_id: sceneId,
        user_id: user.id,
        image_id: imageId,
        image_url: imgUrl,
        master_url: masterUrl,
        prompt: imgData?.prompt || null,
        role: 'inherited',
        sort_order: -1,
        is_primary: false,
      })
      .select()
      .single() as any;

    setSceneImages(prev => ({
      ...prev,
      [sceneId]: [
        ...(prev[sceneId] || []).filter(img => img.role !== 'inherited'),
        ...(newInherited ? [newInherited] : []),
      ],
    }));
  };

  // Remove style anchor image from a scene (without removing the connection)
  const removeStyleAnchor = async (sceneId: string) => {
    await supabase.from('storyboard_scene_images').delete()
      .eq('scene_id', sceneId).eq('role', 'inherited');
    setSceneImages(prev => ({
      ...prev,
      [sceneId]: (prev[sceneId] || []).filter(img => img.role !== 'inherited'),
    }));
  };

  // Save canvas state
  const saveCanvasState = async (state: { zoom: number; panX: number; panY: number }) => {
    if (!currentProject) return;
    await supabase
      .from('storyboard_projects')
      .update({ canvas_state: state })
      .eq('id', currentProject.id) as any;
  };

  // Delete project
  const deleteProject = async (projectId: string) => {
    await supabase.from('storyboard_projects').delete().eq('id', projectId) as any;
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
      setScenes([]);
      setSceneImages({});
      setSceneReferences({});
      setConnections([]);
    }
  };

  // Rename project
  const renameProject = async (projectId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    await supabase.from('storyboard_projects').update({ title: trimmed }).eq('id', projectId) as any;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, title: trimmed } : p));
    if (currentProject?.id === projectId) {
      setCurrentProject(prev => prev ? { ...prev, title: trimmed } : prev);
    }
  };

  // Valid preset keys — used to validate AI choices before saving
  const VALID_PRESET_IDS = ['arri-natural', 'red-commercial', 'sony-venice-night', 'anamorphic-film', 'documentary-street'];
  const VALID_FOCAL_LENGTHS = ['14mm', '24mm', '35mm', '50mm', '85mm', '135mm'];
  const VALID_APERTURES = ['f1.4', 'f2.0', 'f2.8', 'f4.0', 'f5.6', 'f8.0'];
  const VALID_ANGLES = ['eye-level', 'low-angle', 'high-angle', 'dutch-angle', 'birds-eye', 'worms-eye', 'over-shoulder', 'pov', 'close-up', 'wide-shot'];

  // Create scenes from AI Director structure
  const createScenesFromStructure = async (structure: { title: string; concept: string; scenes: any[] }, format: string) => {
    if (!user || !currentProject) return;
    const gap = 100;
    const sceneWidth = 360;
    const startX = 100;
    const startY = 150;

    const createdSceneIds: string[] = [];
    let firstSceneId: string | null = null;

    for (let i = 0; i < structure.scenes.length; i++) {
      const s = structure.scenes[i];
      const posX = startX + i * (sceneWidth + gap);

      // First scene is root; subsequent scenes are children that inherit style
      const isChild = i > 0 && firstSceneId;

      // Use AI-chosen camera params, falling back to cinematic defaults
      const presetId = VALID_PRESET_IDS.includes(s.preset_id) ? s.preset_id : 'arri-natural';
      const focalLength = VALID_FOCAL_LENGTHS.includes(s.focal_length) ? s.focal_length : '35mm';
      const aperture = VALID_APERTURES.includes(s.aperture) ? s.aperture : 'f2.8';
      const cameraAngle = VALID_ANGLES.includes(s.camera_angle) ? s.camera_angle : 'eye-level';

      const { data, error } = await supabase
        .from('storyboard_scenes')
        .insert({
          project_id: currentProject.id,
          user_id: user.id,
          title: s.name || `Cena ${scenes.length + i + 1}`,
          prompt_base: s.suggested_prompt_base || '',
          description: s.visual_description || '',
          aspect_ratio: format,
          style_data: {
            presetId,
            focalLength,
            aperture,
            cameraAngle,
            video_prompt: s.video_prompt || '',
            scene_emotion: s.emotion || '',
          },
          sort_order: scenes.length + i,
          position_x: posX,
          position_y: startY,
          ...(isChild ? { parent_scene_id: firstSceneId, inherit_style: true } : {}),
        })
        .select()
        .single() as any;

      if (error || !data) continue;
      if (i === 0) firstSceneId = data.id;
      createdSceneIds.push(data.id);
      setScenes(prev => [...prev, data]);
    }

    // Create sequential connections
    for (let i = 1; i < createdSceneIds.length; i++) {
      await addConnection(createdSceneIds[i - 1], createdSceneIds[i]);
    }

    // Rename project if it's still default
    if (currentProject.title === 'Novo Storyboard' && structure.title) {
      await renameProject(currentProject.id, structure.title);
    }

    toast.success(`${createdSceneIds.length} cenas criadas pelo AI Director`);
  };

  return {
    projects, currentProject, scenes, sceneImages, sceneReferences, connections, loading,
    hasApiKey, generatingScenes,
    createProject, selectProject, deleteProject, renameProject,
    createScene, updateScene, deleteScene,
    addReference, removeReference, uploadFileAsReference,
    generateImage, setPrimaryImage, removeImageFromScene,
    changeStyleAnchor, removeStyleAnchor,
    addConnection, removeConnection,
    saveCanvasState,
    createScenesFromStructure,
  };
}
