import React, { useState, useEffect } from 'react'
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
import { XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { marcarOportunidadePerdida } from '@/services/oportunidades'
import { getMotivosCatalogo } from '@/services/catalogo'
import { MotivoCatalogo } from '@/types/catalogo'

interface ModalMarcarPerdidaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidadeId: string
  protocolo: string
  onSucesso: () => void
}

export function ModalMarcarPerdida({
  open,
  onOpenChange,
  oportunidadeId,
  protocolo,
  onSucesso,
}: ModalMarcarPerdidaProps) {
  const [motivos, setMotivos] = useState<MotivoCatalogo[]>([])
  const [motivoId, setMotivoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      getMotivosCatalogo(true).then((res) => {
        if (res.data) {
          // Filtrar somente motivos do tipo 'perda' e ativos
          const apenasPerda = res.data.filter(
            (m) => m.tipo === 'perda' && (!m.situacao || m.situacao === 'ativa'),
          )
          setMotivos(apenasPerda)
        }
      })
      setMotivoId('')
      setObservacao('')
      setErro(null)
    }
  }, [open])

  const handleConfirmar = async () => {
    if (!motivoId) {
      setErro('Selecione obrigatoriamente um motivo de perda.')
      return
    }

    // T5.03b — o banco passou a exigir a observação (regra 9).
    if (!observacao.trim()) {
      setErro('Descreva o motivo da perda na observação.')
      return
    }

    setSalvando(true)
    setErro(null)

    const res = await marcarOportunidadePerdida({
      oportunidade_id: oportunidadeId,
      motivo_id: motivoId,
      observacao: observacao.trim() || null,
    })

    setSalvando(false)
    if (res.error) {
      setErro(res.error)
    } else {
      onOpenChange(false)
      onSucesso()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 mb-2">
            <XCircle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-[#0C2D48]">
            Marcar Oportunidade como Perdida
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A oportunidade <strong>{protocolo}</strong> passará para a situação "Perdida". As etapas
            não poderão mais ser concluídas ou avançadas, mas a ficha continuará disponível para
            consulta e auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {erro && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Motivo do catálogo */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Motivo da perda <span className="text-red-500 font-bold">*</span>
            </label>
            <select
              value={motivoId}
              onChange={(e) => {
                setMotivoId(e.target.value)
                if (erro) setErro(null)
              }}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-none"
            >
              <option value="">Selecione o motivo da perda...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Observação obrigatória (T5.03b) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Observação <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Descreva detalhes ou ponderações que justifiquem a perda..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              className="text-xs rounded-xl border-slate-200 focus:border-rose-500"
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
            disabled={salvando || !motivoId || !observacao.trim()}
            className="rounded-xl text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold btn-press"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Marcando como perdida...
              </>
            ) : (
              'Confirmar perda'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
