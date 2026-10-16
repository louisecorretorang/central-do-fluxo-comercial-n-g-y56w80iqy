import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Briefcase, Calendar, DollarSign, User, AlertCircle, CheckCircle2 } from 'lucide-react'

interface NewOpportunityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const formatCurrencyBRL = (value: string): string => {
  // Mantém apenas dígitos
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const num = Number(digits) / 100
  return num.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export const formatDateBR = (value: string): string => {
  // Apenas dígitos para dd/mm/aaaa
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

export const NewOpportunityModal: React.FC<NewOpportunityModalProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast()

  const [title, setTitle] = useState('')
  const [client, setClient] = useState('')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')

  const [errors, setErrors] = useState<{
    title?: string
    client?: string
    deadline?: string
  }>({})

  const resetForm = () => {
    setTitle('')
    setClient('')
    setEstimatedValue('')
    setDeadline('')
    setNotes('')
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEstimatedValue(formatCurrencyBRL(e.target.value))
  }

  const handleDeadlineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeadline(formatDateBR(e.target.value))
    if (errors.deadline) {
      setErrors((prev) => ({ ...prev, deadline: undefined }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { title?: string; client?: string; deadline?: string } = {}

    if (!title.trim()) {
      newErrors.title = 'Preencha o título da oportunidade.'
    }

    if (!client.trim()) {
      newErrors.client = 'Preencha o nome do cliente.'
    }

    if (deadline && deadline.length < 10) {
      newErrors.deadline = 'Informe o prazo no formato dd/mm/aaaa.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Sucesso: Validação concluída sem persistência direta conforme especificado
    toast({
      title: 'Oportunidade criada com sucesso.',
      description: `"${title}" para o cliente ${client}.`,
      className: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    })

    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
        <DialogHeader className="text-left pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/60 flex items-center justify-center text-teal-700">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-[#0C2D48]">
                Nova oportunidade
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Preencha os dados comerciais da nova oportunidade.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Título da oportunidade */}
          <div className="space-y-1.5">
            <Label
              htmlFor="opp-title"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              Título da oportunidade <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="opp-title"
                placeholder="Ex.: Renovação Plano de Saúde PME - 45 vidas"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                }}
                className={`h-11 rounded-xl text-sm transition-all focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  errors.title ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                }`}
                autoFocus
              />
            </div>
            {errors.title && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-1.5">
            <Label
              htmlFor="opp-client"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1"
            >
              Cliente <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                id="opp-client"
                placeholder="Nome da empresa ou contato comercial"
                value={client}
                onChange={(e) => {
                  setClient(e.target.value)
                  if (errors.client) setErrors((prev) => ({ ...prev, client: undefined }))
                }}
                className={`h-11 pl-10 rounded-xl text-sm transition-all focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  errors.client ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                }`}
              />
            </div>
            {errors.client && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {errors.client}
              </p>
            )}
          </div>

          {/* Grid com Valor Estimado e Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="opp-value" className="text-xs font-semibold text-slate-700">
                Valor estimado (R$)
              </Label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="opp-value"
                  placeholder="R$ 0,00"
                  value={estimatedValue}
                  onChange={handleValueChange}
                  className="h-11 pl-10 rounded-xl text-sm border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opp-deadline" className="text-xs font-semibold text-slate-700">
                Prazo (dd/mm/aaaa)
              </Label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="opp-deadline"
                  placeholder="Ex.: 30/11/2026"
                  maxLength={10}
                  value={deadline}
                  onChange={handleDeadlineChange}
                  className={`h-11 pl-10 rounded-xl text-sm transition-all focus-visible:ring-2 focus-visible:ring-teal-600 ${
                    errors.deadline ? 'border-red-400 bg-red-50/20' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.deadline && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {errors.deadline}
                </p>
              )}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="opp-notes" className="text-xs font-semibold text-slate-700">
              Observações
            </Label>
            <Textarea
              id="opp-notes"
              rows={3}
              placeholder="Detalhes adicionais, requisitos de cobertura, operadora de preferência..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none rounded-xl text-sm border-slate-200 focus-visible:ring-2 focus-visible:ring-teal-600"
            />
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="h-11 px-5 rounded-xl text-slate-600 border-slate-200 hover:bg-slate-100 btn-press"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-11 px-6 rounded-xl bg-[#0C2D48] hover:bg-[#071d30] text-white font-semibold flex items-center gap-2 shadow-sm btn-press"
            >
              <CheckCircle2 className="w-4 h-4" />
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default NewOpportunityModal
