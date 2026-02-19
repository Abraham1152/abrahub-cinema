import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, ZoomIn, ZoomOut, RotateCcw, Clapperboard, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SceneBlock } from './SceneBlock';
import type { StoryboardScene, StoryboardSceneImage, SceneReference, SceneConnection } from '@/hooks/useStoryboard';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.15;
const SCENE_WIDTH = 360;
const SCENE_HEADER_HEIGHT = 40; // approximate center of header for port Y

interface StoryboardCanvasProps {
  scenes: StoryboardScene[];
  sceneImages: Record<string, StoryboardSceneImage[]>;
  sceneReferences: Record<string, SceneReference[]>;
  connections: SceneConnection[];
  generatingScenes: Set<string>;
  onCreateScene: (fromSceneId?: string) => void;
  onUpdateScene: (id: string, updates: Partial<StoryboardScene>) => void;
  onDeleteScene: (id: string) => void;
  onAddReference: (sceneId: string, imageId: string, previewUrl?: string, prompt?: string) => void;
  onRemoveReference: (sceneId: string, refId: string) => void;
  onGenerateImage: (sceneId: string) => void;
  onSetPrimary: (sceneId: string, imageId: string) => void;
  onRemoveImage: (imageId: string, sceneId: string) => void;
  onUploadFileAsReference: (sceneId: string, file: File) => void;
  onChangeStyleAnchor: (sceneId: string, imageId: string, previewUrl?: string) => void;
  onAddConnection: (fromId: string, toId: string) => void;
  onRemoveConnection: (connId: string) => void;
  onSaveCanvasState: (state: { zoom: number; panX: number; panY: number }) => void;
  onOpenAIDirector?: () => void;
  onOpenAnimationBatch?: () => void;
}

export function StoryboardCanvas({
  scenes, sceneImages, sceneReferences, connections, generatingScenes,
  onCreateScene, onUpdateScene, onDeleteScene,
  onAddReference, onRemoveReference,
  onGenerateImage, onSetPrimary, onRemoveImage,
  onUploadFileAsReference, onChangeStyleAnchor, onAddConnection, onRemoveConnection,
  onSaveCanvasState,
  onOpenAIDirector, onOpenAnimationBatch,
}: StoryboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Connection dragging state
  const [draggingConnection, setDraggingConnection] = useState<{
    fromSceneId: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);

  // Scene position
  const getScenePosition = useCallback((scene: StoryboardScene) => {
    if (scene.position_x !== 0 || scene.position_y !== 0) {
      return { x: scene.position_x, y: scene.position_y };
    }
    const sortedKeys = [...new Set(scenes.map(s => s.sort_order))].sort((a, b) => a - b);
    const colIndex = sortedKeys.indexOf(scene.sort_order);
    return { x: 100 + colIndex * (SCENE_WIDTH + 100), y: 150 };
  }, [scenes]);

  // Save canvas state debounced
  useEffect(() => {
    const t = setTimeout(() => onSaveCanvasState({ zoom, panX: pan.x, panY: pan.y }), 500);
    return () => clearTimeout(t);
  }, [zoom, pan.x, pan.y]);

  // Get the output port position (right side) of a scene in canvas coords
  const getOutputPort = useCallback((scene: StoryboardScene) => {
    const pos = getScenePosition(scene);
    return { x: pos.x + SCENE_WIDTH, y: pos.y + SCENE_HEADER_HEIGHT };
  }, [getScenePosition]);

  // Get the input port position (left side) of a scene in canvas coords
  const getInputPort = useCallback((scene: StoryboardScene) => {
    const pos = getScenePosition(scene);
    return { x: pos.x, y: pos.y + SCENE_HEADER_HEIGHT };
  }, [getScenePosition]);

  // Convert client coords to canvas coords
  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan.x, pan.y, zoom]);

  // Handle connection drag start from output port
  const handleConnectionDragStart = useCallback((sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    setDraggingConnection({ fromSceneId: sceneId, mouseX: canvasPos.x, mouseY: canvasPos.y });
  }, [clientToCanvas]);

  // Handle mouse move for connection dragging
  const handleConnectionMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingConnection) return;
    const canvasPos = clientToCanvas(e.clientX, e.clientY);
    setDraggingConnection(prev => prev ? { ...prev, mouseX: canvasPos.x, mouseY: canvasPos.y } : null);
  }, [draggingConnection, clientToCanvas]);

  // Handle drop on input port
  const handleConnectionDrop = useCallback((toSceneId: string) => {
    if (!draggingConnection) return;
    if (draggingConnection.fromSceneId !== toSceneId) {
      onAddConnection(draggingConnection.fromSceneId, toSceneId);
    }
    setDraggingConnection(null);
  }, [draggingConnection, onAddConnection]);

  // Cancel connection on mouse up anywhere
  const handleGlobalMouseUp = useCallback(() => {
    if (draggingConnection) {
      setDraggingConnection(null);
    }
  }, [draggingConnection]);

  const zoomToCenter = useCallback((direction: 'in' | 'out') => {
    setZoom(prev => {
      const next = direction === 'in'
        ? Math.min(MAX_ZOOM, prev + ZOOM_STEP)
        : Math.max(MIN_ZOOM, prev - ZOOM_STEP);
      if (!containerRef.current) return next;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      setPan(p => ({
        x: cx - (cx - p.x) * (next / prev),
        y: cy - (cy - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag], [role="listbox"], [data-radix-scroll-area-viewport]')) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return next;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPan(p => ({
        x: mx - (mx - p.x) * (next / prev),
        y: my - (my - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-scene-block]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan.x, pan.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Handle connection dragging
    if (draggingConnection) {
      handleConnectionMouseMove(e);
      return;
    }
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning, draggingConnection, handleConnectionMouseMove]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    handleGlobalMouseUp();
  }, [handleGlobalMouseUp]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-scene-block]')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setZoom(prev => {
      const next = prev >= MAX_ZOOM ? 1 : Math.min(MAX_ZOOM, prev + 0.3);
      setPan(p => ({
        x: mx - (mx - p.x) * (next / prev),
        y: my - (my - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  // Render SVG connections + dragging line
  const renderConnections = () => {
    const lines = connections.map(conn => {
      const fromScene = scenes.find(s => s.id === conn.from_scene_id);
      const toScene = scenes.find(s => s.id === conn.to_scene_id);
      if (!fromScene || !toScene) return null;
      const from = getOutputPort(fromScene);
      const to = getInputPort(toScene);
      const midX = (from.x + to.x) / 2;
      const isInheriting = toScene.parent_scene_id === conn.from_scene_id && toScene.inherit_style;
      const pathD = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
      return (
        <g key={conn.id} className="cursor-pointer group">
          {/* Invisible wide hit area */}
          <path
            d={pathD}
            stroke="transparent"
            strokeWidth={16}
            fill="none"
            style={{ pointerEvents: 'stroke' }}
            onClick={(e) => { e.stopPropagation(); onRemoveConnection(conn.id); }}
          />
          {/* Visible line */}
          <path
            d={pathD}
            stroke={isInheriting ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary) / 0.25)'}
            strokeWidth={isInheriting ? 2.5 : 1.5}
            strokeDasharray={isInheriting ? undefined : '6 4'}
            fill="none"
            markerEnd="url(#arrowhead)"
            style={{ pointerEvents: 'none' }}
            className="group-hover:stroke-destructive transition-colors"
          />
          {/* Delete icon on hover - midpoint */}
          <foreignObject
            x={(from.x + to.x) / 2 - 10}
            y={(from.y + to.y) / 2 - 10}
            width={20}
            height={20}
            className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          >
            <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-destructive-foreground text-[10px] font-bold">✕</span>
            </div>
          </foreignObject>
        </g>
      );
    });

    // Dragging line
    let dragLine = null;
    if (draggingConnection) {
      const fromScene = scenes.find(s => s.id === draggingConnection.fromSceneId);
      if (fromScene) {
        const from = getOutputPort(fromScene);
        const to = { x: draggingConnection.mouseX, y: draggingConnection.mouseY };
        const midX = (from.x + to.x) / 2;
        dragLine = (
          <path
            d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
            stroke="hsl(var(--primary) / 0.6)"
            strokeWidth={2}
            fill="none"
            strokeDasharray="6 3"
            className="animate-pulse"
          />
        );
      }
    }

    if (connections.length === 0 && !dragLine) return null;

    return (
      <svg className="absolute inset-0" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary) / 0.4)" />
          </marker>
        </defs>
        <g style={{ pointerEvents: 'auto' }}>
          {lines}
        </g>
        {dragLine}
      </svg>
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5 shadow-sm">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomToCenter('in')}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoomToCenter('out')}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scene count */}
      {scenes.length > 0 && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-sm">
          <span className="text-xs font-medium tabular-nums">
            {scenes.length} {scenes.length === 1 ? 'cena' : 'cenas'}
          </span>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {onOpenAIDirector && (
          <Button onClick={onOpenAIDirector} variant="outline" className="gap-2 shadow-lg" size="sm">
            <Clapperboard className="h-4 w-4" />
            AI Director
          </Button>
        )}
        <Button onClick={() => onCreateScene()} className="gap-2 shadow-lg" size="sm">
          <Plus className="h-4 w-4" />
          Nova cena
        </Button>
        {onOpenAnimationBatch && scenes.length > 0 && (
          <Button onClick={onOpenAnimationBatch} variant="outline" className="gap-2 shadow-lg" size="sm">
            <Film className="h-4 w-4" />
            Animação
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`h-full w-full ${draggingConnection ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="relative"
        >
          {/* Connections SVG */}
          {renderConnections()}

          {/* Scenes */}
          {scenes.map((scene, i) => {
            const pos = getScenePosition(scene);
            return (
              <div
                key={scene.id}
                data-scene-block
                className="absolute"
                style={{ left: pos.x, top: pos.y, width: SCENE_WIDTH }}
              >
                <SceneBlock
                  scene={scene}
                  images={sceneImages[scene.id] || []}
                  references={sceneReferences[scene.id] || []}
                  index={i}
                  isDraggable={!draggingConnection}
                  zoom={zoom}
                  computedPosition={pos}
                  isGenerating={generatingScenes.has(scene.id)}
                  onUpdate={onUpdateScene}
                  onDelete={onDeleteScene}
                  onAddReference={onAddReference}
                  onRemoveReference={onRemoveReference}
                  onGenerateImage={onGenerateImage}
                  onSetPrimary={onSetPrimary}
                  onRemoveImage={onRemoveImage}
                  onUploadFileAsReference={onUploadFileAsReference}
                  onChangeStyleAnchor={onChangeStyleAnchor}
                  onCreateFromScene={(sceneId) => onCreateScene(sceneId)}
                  onStartConnectionDrag={handleConnectionDragStart}
                  onDropConnection={handleConnectionDrop}
                  isDraggingConnection={!!draggingConnection}
                  draggingFromId={draggingConnection?.fromSceneId || null}
                />
              </div>
            );
          })}

          {/* Empty state */}
          {scenes.length === 0 && (
            <div className="absolute" style={{ left: 200, top: 200 }}>
              <div className="text-center text-muted-foreground/50 py-8">
                <p className="text-sm">Clique em "Nova cena" para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}