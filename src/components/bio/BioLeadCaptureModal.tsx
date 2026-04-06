import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import type { BioPage } from '@/types/bio'

interface BioLeadCaptureModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name?: string; phone?: string; email?: string }) => void
  page: BioPage
  isSubmitting: boolean
}

export function BioLeadCaptureModal({
  open,
  onClose,
  onSubmit,
  page,
  isSubmitting,
}: BioLeadCaptureModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const fields = page.capture_fields ?? ['name', 'phone']
  const wantsName = fields.includes('name')
  const wantsPhone = fields.includes('phone')
  const wantsEmail = fields.includes('email')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      name: wantsName ? name : undefined,
      phone: wantsPhone ? phone : undefined,
      email: wantsEmail ? email : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{page.capture_title || 'Preencha seus dados'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          {wantsName && (
            <div className="space-y-1.5">
              <Label htmlFor="capture-name">Nome</Label>
              <Input
                id="capture-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                autoComplete="name"
              />
            </div>
          )}

          {wantsPhone && (
            <div className="space-y-1.5">
              <Label htmlFor="capture-phone">WhatsApp</Label>
              <Input
                id="capture-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                required
                autoComplete="tel"
              />
            </div>
          )}

          {wantsEmail && (
            <div className="space-y-1.5">
              <Label htmlFor="capture-email">E-mail</Label>
              <Input
                id="capture-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none">
              {isSubmitting && <Loader2 size={14} className="animate-spin mr-1" />}
              {page.capture_button_label || 'Continuar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
