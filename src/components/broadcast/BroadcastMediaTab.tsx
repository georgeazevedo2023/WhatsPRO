import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Image, Video, Mic, FileIcon, Upload, X } from 'lucide-react';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { toast } from 'sonner';
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, ALLOWED_AUDIO_TYPES, getAcceptedTypes, type MediaType } from '@/lib/broadcastSender';

interface BroadcastMediaTabProps {
  mediaType: MediaType;
  setMediaType: (type: MediaType) => void;
  mediaUrl: string;
  setMediaUrl: (url: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  caption: string;
  setCaption: (caption: string) => void;
  isPtt: boolean;
  setIsPtt: (ptt: boolean) => void;
  filename: string;
  setFilename: (name: string) => void;
  isSending: boolean;
}

const BroadcastMediaTab = ({
  mediaType, setMediaType,
  mediaUrl, setMediaUrl,
  selectedFile, setSelectedFile,
  previewUrl, setPreviewUrl,
  caption, setCaption,
  isPtt, setIsPtt,
  filename, setFilename,
  isSending,
}: BroadcastMediaTabProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setFilename('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }
    if (mediaType === 'video' && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast.error('Apenas vídeos MP4 são suportados');
      return;
    }
    if (mediaType === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Formato de imagem não suportado');
      return;
    }
    if (mediaType === 'audio' && !ALLOWED_AUDIO_TYPES.includes(file.type)) {
      toast.error('Formato de áudio não suportado (use MP3 ou OGG)');
      return;
    }

    clearFile();
    setSelectedFile(file);
    setFilename(file.name);

    if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') {
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleChangeType = (type: MediaType) => {
    setMediaType(type);
    clearFile();
  };

  return (
    <div className="space-y-4">
      {/* Media Type Selector */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { type: 'image' as const, icon: Image, label: 'Imagem' },
          { type: 'video' as const, icon: Video, label: 'Vídeo' },
          { type: 'audio' as const, icon: Mic, label: 'Áudio' },
          { type: 'file' as const, icon: FileIcon, label: 'Arquivo' },
        ]).map(({ type, icon: Icon, label }) => (
          <Button
            key={type}
            type="button"
            variant={mediaType === type ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleChangeType(type)}
            disabled={isSending}
            className="flex flex-col items-center gap-1 h-auto py-2"
          >
            <Icon className="w-4 h-4" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>

      {/* URL Input */}
      <div className="space-y-2">
        <Label>URL da mídia</Label>
        <Input
          placeholder="https://exemplo.com/arquivo.jpg"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          disabled={isSending || !!selectedFile}
        />
      </div>

      {/* Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">ou</span>
        </div>
      </div>

      {/* File Input */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptedTypes(mediaType)}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isSending}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending || !!mediaUrl.trim()}
          className="w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          Escolher do dispositivo
        </Button>
      </div>

      {/* Preview */}
      {selectedFile && (
        <div className="relative border border-border rounded-lg p-3 bg-muted/30">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearFile}
            className="absolute top-1 right-1 h-6 w-6"
            disabled={isSending}
          >
            <X className="w-4 h-4" />
          </Button>
          
          {mediaType === 'image' && previewUrl && (
            <img src={previewUrl} alt="Preview" className="max-h-40 rounded mx-auto" />
          )}
          {mediaType === 'video' && previewUrl && (
            <video src={previewUrl} controls className="max-h-40 rounded mx-auto" />
          )}
          {mediaType === 'audio' && previewUrl && (
            <audio src={previewUrl} controls className="w-full" />
          )}
          {mediaType === 'file' && (
            <div className="flex items-center gap-2">
              <FileIcon className="w-8 h-8 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filename for documents */}
      {mediaType === 'file' && (
        <div className="space-y-2">
          <Label>Nome do arquivo</Label>
          <Input
            placeholder="documento.pdf"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={isSending}
          />
        </div>
      )}

      {/* PTT Toggle for audio */}
      {mediaType === 'audio' && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor="ptt-toggle" className="text-sm font-medium cursor-pointer">
                Enviar como mensagem de voz
              </Label>
              <p className="text-xs text-muted-foreground">
                Aparecerá como áudio gravado no WhatsApp
              </p>
            </div>
          </div>
          <Switch
            id="ptt-toggle"
            checked={isPtt}
            onCheckedChange={setIsPtt}
            disabled={isSending}
          />
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <Label>Legenda (opcional)</Label>
        <Textarea
          placeholder="Adicione uma legenda..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={isSending}
          className="min-h-[80px] resize-none"
        />
        <EmojiPicker onEmojiSelect={(emoji) => setCaption(caption + emoji)} disabled={isSending} />
      </div>
    </div>
  );
};

export default BroadcastMediaTab;
