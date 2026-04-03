import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Paperclip, Image, FileText, Music, Video, Download, Inbox, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import type { MediaFile } from './types';

interface LeadFilesSectionProps {
  mediaFiles: MediaFile[];
}

export function LeadFilesSection({ mediaFiles }: LeadFilesSectionProps) {
  const received = mediaFiles.filter(f => f.direction === 'incoming');
  const sent = mediaFiles.filter(f => f.direction === 'outgoing');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          Arquivos
          <Badge variant="secondary" className="text-xs">{mediaFiles.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mediaFiles.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Inbox className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum arquivo</p>
          </div>
        ) : (
          <Tabs defaultValue="received">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="received" className="flex-1 gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" />Recebidos ({received.length})
              </TabsTrigger>
              <TabsTrigger value="sent" className="flex-1 gap-1.5 text-xs">
                <Inbox className="w-3.5 h-3.5" />Enviados ({sent.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received">
              <FileList files={received} />
            </TabsContent>
            <TabsContent value="sent">
              <FileList files={sent} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function FileList({ files }: { files: MediaFile[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo</p>;
  }

  const images = files.filter(f => f.media_type === 'image');
  const documents = files.filter(f => f.media_type === 'document');
  const audios = files.filter(f => f.media_type === 'audio' || f.media_type === 'ptt');
  const videos = files.filter(f => f.media_type === 'video');

  return (
    <div className="space-y-4">
      {/* Images grid */}
      {images.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
            <Image className="w-3.5 h-3.5" />Imagens ({images.length})
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.slice(0, 12).map(f => (
              <SignedImage key={f.id} url={f.media_url} />
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      {documents.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
            <FileText className="w-3.5 h-3.5" />Documentos ({documents.length})
          </p>
          <div className="space-y-1.5">
            {documents.map(f => (
              <a
                key={f.id}
                href={f.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{f.content || 'Documento'}</span>
                <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Audios */}
      {audios.length > 0 && <AudioList audios={audios} />}

      {/* Videos */}
      {videos.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
            <Video className="w-3.5 h-3.5" />Videos ({videos.length})
          </p>
          <div className="space-y-1.5">
            {videos.slice(0, 5).map(f => (
              <a key={f.id} href={f.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <Video className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm flex-1">Video</span>
                <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString('pt-BR')}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AudioList({ audios }: { audios: MediaFile[] }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 3;
  const visible = showAll ? audios : audios.slice(0, INITIAL_COUNT);
  const hasMore = audios.length > INITIAL_COUNT;

  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
        <Music className="w-3.5 h-3.5" />Audios ({audios.length})
      </p>
      <div className="space-y-2">
        {visible.map(f => (
          <div key={f.id} className="p-3 rounded-lg border space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${f.direction === 'incoming' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                {f.direction === 'incoming' ? 'Lead' : 'Agente'}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(f.created_at).toLocaleDateString('pt-BR')} {new Date(f.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <SignedAudio url={f.media_url} />
            {f.transcription && (
              <p className="text-xs text-muted-foreground italic">"{f.transcription}"</p>
            )}
          </div>
        ))}
      </div>
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs gap-1"
          onClick={() => setShowAll(!showAll)}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Mostrar menos' : `Ver mais ${audios.length - INITIAL_COUNT} audios`}
        </Button>
      )}
    </div>
  );
}

/** Wraps native audio with signed URL resolution for private Supabase Storage buckets */
function SignedAudio({ url }: { url: string }) {
  const signedUrl = useSignedUrl(url);
  if (!signedUrl) return <div className="w-full h-8 bg-muted rounded animate-pulse" />;
  return (
    <audio controls preload="metadata" className="w-full h-8" style={{ minHeight: 32 }}>
      <source src={signedUrl} />
    </audio>
  );
}

function SignedImage({ url }: { url: string }) {
  const signedUrl = useSignedUrl(url);
  return (
    <a href={signedUrl || url} target="_blank" rel="noopener noreferrer" className="block group">
      <img
        src={signedUrl || url}
        alt=""
        className="w-full h-24 object-cover rounded-lg border group-hover:opacity-80 transition-opacity"
      />
    </a>
  );
}
