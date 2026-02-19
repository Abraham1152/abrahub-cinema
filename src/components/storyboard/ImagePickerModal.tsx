import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Search, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UserImage {
  id: string;
  preview_url: string | null;
  master_url: string | null;
  prompt: string;
  is_story6?: boolean;
}

interface ImagePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (image: UserImage) => void;
  onSelectFile?: (file: File) => void;
}

export function ImagePickerModal({ open, onOpenChange, onSelectImage, onSelectFile }: ImagePickerModalProps) {
  const [images, setImages] = useState<UserImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 10MB)');
      return;
    }
    onSelectFile?.(file);
    onOpenChange(false);
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('user_generated_images')
      .select('id, preview_url, master_url, prompt, is_story6')
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setImages((data as UserImage[]) || []);
        setLoading(false);
      });
  }, [open]);

  const filtered = search
    ? images.filter(img => img.prompt?.toLowerCase().includes(search.toLowerCase()))
    : images;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Selecionar imagem</DialogTitle>
        </DialogHeader>

        {onSelectFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Abrir do computador
            </Button>
          </>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por prompt..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma imagem encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-1">
              {filtered.map(img => (
                <div key={img.id} className="relative group">
                  <button
                    className="w-full aspect-video rounded-lg overflow-hidden border border-border hover:border-primary hover:ring-2 hover:ring-primary/30 transition-all bg-secondary"
                    onClick={() => {
                      onSelectImage(img);
                      onOpenChange(false);
                    }}
                  >
                    {(img.preview_url || img.master_url) ? (
                      <img
                        src={img.preview_url || img.master_url!}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[9px] text-white line-clamp-2">{img.prompt}</p>
                    </div>
                  </button>

                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
