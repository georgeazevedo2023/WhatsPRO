import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export type SendStatus = 'idle' | 'sending' | 'success' | 'error';

interface SendStatusModalProps {
  status: SendStatus;
  message?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'text';
  progress?: { current: number; total: number };
  onClose: () => void;
}

const SendStatusModal = ({ status, message, mediaType, progress, onClose }: SendStatusModalProps) => {
  // Auto-close on success after 3 seconds
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, onClose]);

  const isOpen = status !== 'idle';
  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          {status === 'sending' && (
            <>
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <h3 className="text-lg font-semibold">Enviando...</h3>
              {progress && progress.total > 1 ? (
                <div className="w-full space-y-2">
                  <Progress value={progressPercent} className="h-2" />
                  <p className="text-muted-foreground text-center text-sm">
                    Enviando {progress.current}/{progress.total} mensagens
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-center">
                  Enviando mensagem para o grupo
                </p>
              )}
            </>
          )}

          {status === 'success' && (
            <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <h3 className="text-xl font-semibold text-green-600">
                {mediaType === 'image' && 'Imagem enviada com sucesso!'}
                {mediaType === 'video' && 'Vídeo enviado com sucesso!'}
                {mediaType === 'audio' && 'Áudio enviado com sucesso!'}
                {mediaType === 'ptt' && 'Mensagem de voz enviada com sucesso!'}
                {mediaType === 'document' && 'Arquivo enviado com sucesso!'}
                {(!mediaType || mediaType === 'text') && (
                  progress && progress.total > 1 
                    ? `${progress.total} mensagens enviadas!`
                    : 'Mensagem enviada com sucesso!'
                )}
              </h3>
              <p className="text-muted-foreground text-center">
                {mediaType === 'image' && 'Imagem entregue ao grupo'}
                {mediaType === 'video' && 'Vídeo entregue ao grupo'}
                {mediaType === 'audio' && 'Áudio entregue ao grupo'}
                {mediaType === 'ptt' && 'Mensagem de voz entregue ao grupo'}
                {mediaType === 'document' && 'Arquivo entregue ao grupo'}
                {(!mediaType || mediaType === 'text') && (
                  progress && progress.total > 1 
                    ? 'Mensagens entregues aos membros'
                    : 'Mensagem entregue ao grupo'
                )}
              </p>
            </div>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-destructive" />
              <h3 className="text-lg font-semibold text-destructive">Erro ao enviar</h3>
              <p className="text-muted-foreground text-center">
                {message || 'Ocorreu um erro ao enviar a mensagem'}
              </p>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendStatusModal;
