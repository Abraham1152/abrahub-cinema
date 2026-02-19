import { useState } from 'react';
import { Clapperboard, Focus, Aperture, Plus, RefreshCw, Move3d, Film } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { usePresets, type PresetWithPromptBlock } from '@/hooks/usePresets';
import { PresetList } from './PresetList';
import { PresetFormModal } from './PresetFormModal';
import { toast } from 'sonner';

type PresetType = 'camera' | 'angle' | 'focal' | 'aperture' | 'film_look';

export function PresetManager() {
  const [activeTab, setActiveTab] = useState<PresetType>('camera');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetWithPromptBlock | null>(null);

  const { presets, loading, error, refetch } = usePresets(true); // Include inactive for admin

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Presets atualizados');
  };

  const handleNewPreset = () => {
    setEditingPreset(null);
    setFormModalOpen(true);
  };

  const handleEditPreset = (preset: PresetWithPromptBlock) => {
    setEditingPreset(preset);
    setFormModalOpen(true);
  };

  const handleFormClose = () => {
    setFormModalOpen(false);
    setEditingPreset(null);
  };

  const handleFormSave = async () => {
    await refetch();
    handleFormClose();
  };

  const tabs = [
    { id: 'camera' as const, label: 'Camera Rig', icon: Clapperboard, count: presets.camera.length },
    { id: 'angle' as const, label: 'Ângulos', icon: Move3d, count: presets.angle.length },
    { id: 'focal' as const, label: 'Focal Length', icon: Focus, count: presets.focal.length },
    { id: 'aperture' as const, label: 'Abertura', icon: Aperture, count: presets.aperture.length },
    { id: 'film_look' as const, label: 'Film Look', icon: Film, count: presets.film_look.length },
  ];

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={handleRefresh} className="mt-4">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-primary" />
              Gerenciador de Presets
            </CardTitle>
            <CardDescription>
              Crie e gerencie os presets de câmera, lentes focais e aberturas usados na geração de imagens
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleNewPreset}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Preset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PresetType)}>
          <TabsList className="grid w-full grid-cols-5">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span className="text-xs text-muted-foreground">({tab.count})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-4">
              <PresetList
                type={tab.id}
                presets={presets[tab.id]}
                loading={loading}
                onEdit={handleEditPreset}
                onRefresh={refetch}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Form Modal */}
      <PresetFormModal
        open={formModalOpen}
        preset={editingPreset}
        type={activeTab}
        onClose={handleFormClose}
        onSave={handleFormSave}
      />
    </Card>
  );
}
