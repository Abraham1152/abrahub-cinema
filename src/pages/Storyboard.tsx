import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStoryboard, StoryboardProject } from '@/hooks/useStoryboard';
import { StoryboardCanvas } from '@/components/storyboard/StoryboardCanvas';
import { Header } from '@/components/layout/Header';
import { useCredits } from '@/hooks/useCredits';
import { Button } from '@/components/ui/button';
import { Plus, FolderOpen, Trash2, Loader2 } from 'lucide-react';
import { AIDirectorModal } from '@/components/storyboard/AIDirectorModal';
import { AnimationBatchModal } from '@/components/storyboard/AnimationBatchModal';
import type { GeneratedStructure } from '@/components/storyboard/AIDirectorPreview';

function EditableProjectTitle({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(title); }, [title]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) onSave(trimmed);
    else setValue(title);
  };

  if (!editing) {
    return (
      <span
        className="text-sm font-medium cursor-pointer hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-secondary"
        onClick={() => setEditing(true)}
        title="Clique para editar"
      >
        {title}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(title); setEditing(false); } }}
      className="text-sm font-medium bg-secondary border border-border rounded px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary"
    />
  );
}

export default function Storyboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { credits } = useCredits(user?.id);
  const availableCredits = credits.available || 0;
  const totalCredits = credits.total || 0;
  const {
    projects, currentProject, scenes, sceneImages, sceneReferences, connections, loading,
    hasApiKey, generatingScenes,
    createProject, selectProject, deleteProject, renameProject,
    createScene, updateScene, deleteScene,
    addReference, removeReference, uploadFileAsReference,
    generateImage, setPrimaryImage, removeImageFromScene,
    addConnection, removeConnection,
    saveCanvasState,
    createScenesFromStructure,
  } = useStoryboard();

  const [aiDirectorOpen, setAiDirectorOpen] = useState(false);
  const [animationBatchOpen, setAnimationBatchOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const handleCreateProject = async () => {
    const project = await createProject();
    if (project) selectProject(project);
  };

  const handleAIDirectorConfirm = async (structure: GeneratedStructure, format: string) => {
    await createScenesFromStructure(structure, format);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No BYOK gate needed - Storyboard now uses the same Studio pipeline

  // Project list view
  if (!currentProject) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header user={user} />
        <div className="flex-1 container max-w-2xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Storyboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Organize suas cenas e gere imagens com continuidade visual
              </p>
            </div>
            <Button onClick={handleCreateProject} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Projeto
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum projeto ainda</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={handleCreateProject}>
                <Plus className="h-4 w-4" />
                Criar primeiro projeto
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 bg-background transition-colors cursor-pointer group"
                  onClick={() => selectProject(p)}
                >
                  <div>
                    <h3 className="font-medium">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive"
                    onClick={e => {
                      e.stopPropagation();
                      deleteProject(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Canvas view
  return (
    <div className="h-screen flex flex-col bg-background">
      <Header user={user} />
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
        <Button variant="ghost" size="sm" onClick={() => selectProject(null as any)}>
          ← Projetos
        </Button>
        <EditableProjectTitle
          title={currentProject.title}
          onSave={(newTitle) => renameProject(currentProject.id, newTitle)}
        />
      </div>
      <div className="flex-1">
        <StoryboardCanvas
          scenes={scenes}
          sceneImages={sceneImages}
          sceneReferences={sceneReferences}
          connections={connections}
          generatingScenes={generatingScenes}
          onCreateScene={createScene}
          onUpdateScene={updateScene}
          onDeleteScene={deleteScene}
          onAddReference={addReference}
          onRemoveReference={removeReference}
          onGenerateImage={generateImage}
          onSetPrimary={setPrimaryImage}
          onRemoveImage={removeImageFromScene}
          onUploadFileAsReference={uploadFileAsReference}
          onAddConnection={addConnection}
          onRemoveConnection={removeConnection}
          onSaveCanvasState={saveCanvasState}
          onOpenAIDirector={() => setAiDirectorOpen(true)}
          onOpenAnimationBatch={() => setAnimationBatchOpen(true)}
        />
      </div>

      <AIDirectorModal
        open={aiDirectorOpen}
        onClose={() => setAiDirectorOpen(false)}
        onConfirm={handleAIDirectorConfirm}
      />

      <AnimationBatchModal
        open={animationBatchOpen}
        onClose={() => setAnimationBatchOpen(false)}
        scenes={scenes}
      />
    </div>
  );
}
