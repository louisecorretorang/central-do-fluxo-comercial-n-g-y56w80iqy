import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Archive, AlertCircle, Loader2 } from 'lucide-react'
import { arquivarOportunidade } from '@/services/oportunidades'

interface ModalArquivarOportunidadeProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidadeId: string
  protocolo: string
  onSucesso: () => void
}

export function ModalArquivarOportunidade({
  open,
  onOpenChange,
  oportunidadeId,
  protocolo,
  onSucesso,
}: ModalArquivarOportunidadeProps) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleConfirmar = async () => {
    setSalvando(true)
    setErro(null)

    const res = await arquivarOportunidade({
      oportunidade_id: oportunidadeId,
      motivo: motivo.trim() || null,
    })

    setSalvando(false)
    if (res.error) {
      setErro(res.error)
    } else {
      setMotivo('')
      onOpenChange(false)
      onSucesso()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 mb-2">
            <Archive className="w-5 h-5 text-slate-700" />
          </div>
          <DialogTitle className="text-lg font-bold text-[#0C2D48]">
            Arquivar Oportunidade
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A oportunidade <strong>{protocolo}</strong> passará para a situação "Arquivada". Ação
            restrita a Administradores e Gestores. O registro permanecerá no histórico do sistema
            (não é excluído).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {erro && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Motivo do arquivamento <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <Textarea
              placeholder="Descreva a razão de arquivamento desta oportunidade..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="text-xs rounded-xl border-slate-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="rounded-xl text-xs h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando}
            className="rounded-xl text-xs h-9 bg-slate-800 hover:bg-slate-900 text-white font-semibold btn-press"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Arquivando...
              </>
            ) : (
              'Confirmar Arquivamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
