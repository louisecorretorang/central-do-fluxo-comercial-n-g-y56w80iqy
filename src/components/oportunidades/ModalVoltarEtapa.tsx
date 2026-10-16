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
import { RotateCcw, AlertTriangle, Loader2 } from 'lucide-react'
import { voltarEtapaOportunidade } from '@/services/oportunidades'

interface ModalVoltarEtapaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidadeId: string
  etapaAtualId: string
  etapaAtualNome: string
  etapaAnteriorNome: string
  onSucesso: () => void
}

export function ModalVoltarEtapa({
  open,
  onOpenChange,
  oportunidadeId,
  etapaAtualId,
  etapaAtualNome,
  etapaAnteriorNome,
  onSucesso,
}: ModalVoltarEtapaProps) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleConfirmar = async () => {
    const texto = motivo.trim()
    if (!texto) {
      setErro('Informe obrigatoriamente o motivo do retorno da etapa.')
      return
    }

    setSalvando(true)
    setErro(null)

    const res = await voltarEtapaOportunidade({
      oportunidade_id: oportunidadeId,
      etapa_atual_id: etapaAtualId,
      motivo: texto,
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
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 mb-2">
            <RotateCcw className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-[#0C2D48]">
            Voltar para a etapa anterior
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A etapa atual (<strong>{etapaAtualNome}</strong>) voltará para pendente e a etapa
            anterior (<strong>{etapaAnteriorNome}</strong>) voltará a ser a etapa em andamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {erro && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Motivo do retorno <span className="text-red-500 font-bold">*</span>
            </label>
            <Textarea
              placeholder="Descreva claramente por que a oportunidade está voltando de etapa..."
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                if (erro) setErro(null)
              }}
              rows={4}
              className="text-xs rounded-xl border-slate-200 focus:border-amber-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Este motivo ficará registrado permanentemente na linha do tempo da oportunidade.
            </p>
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
            disabled={salvando || !motivo.trim()}
            className="rounded-xl text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold btn-press"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Voltando etapa...
              </>
            ) : (
              'Confirmar retorno'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
