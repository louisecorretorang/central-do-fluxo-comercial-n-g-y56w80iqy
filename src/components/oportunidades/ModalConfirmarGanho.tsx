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
import { Input } from '@/components/ui/input'
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { confirmarGanhoOportunidade } from '@/services/oportunidades'
import { getSeguradorasOperadoras } from '@/services/catalogo'
import { SeguradoraOperadora } from '@/types/catalogo'
import { formatCurrencyBRL, parseCurrencyToNumber } from '@/components/NewOpportunityModal'

interface ModalConfirmarGanhoProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  oportunidadeId: string
  protocolo: string
  seguradoraIdAtual?: string | null
  valorEstimadoAtual: number
  numeroQuiverAtual?: string | null
  onSucesso: () => void
}

export function ModalConfirmarGanho({
  open,
  onOpenChange,
  oportunidadeId,
  protocolo,
  seguradoraIdAtual,
  valorEstimadoAtual,
  numeroQuiverAtual,
  onSucesso,
}: ModalConfirmarGanhoProps) {
  const [seguradoras, setSeguradoras] = useState<SeguradoraOperadora[]>([])
  const [seguradoraId, setSeguradoraId] = useState<string>(seguradoraIdAtual || '')
  const [valorFechadoStr, setValorFechadoStr] = useState<string>(
    valorEstimadoAtual > 0
      ? valorEstimadoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : '',
  )
  const [numeroProposta, setNumeroProposta] = useState<string>(numeroQuiverAtual || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      getSeguradorasOperadoras().then((res) => {
        if (res.data) setSeguradoras(res.data)
      })
      setSeguradoraId(seguradoraIdAtual || '')
      setValorFechadoStr(
        valorEstimadoAtual > 0
          ? valorEstimadoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : '',
      )
      setNumeroProposta(numeroQuiverAtual || '')
      setErro(null)
    }
  }, [open, seguradoraIdAtual, valorEstimadoAtual, numeroQuiverAtual])

  const handleConfirmar = async () => {
    const valorNumerico = parseCurrencyToNumber(valorFechadoStr)
    if (valorNumerico <= 0) {
      setErro('Informe o valor fechado da proposta em R$.')
      return
    }

    if (!numeroProposta.trim()) {
      setErro('Informe o nº da proposta ou apólice gerada.')
      return
    }

    setSalvando(true)
    setErro(null)

    const res = await confirmarGanhoOportunidade({
      oportunidade_id: oportunidadeId,
      seguradora_id: seguradoraId || null,
      valor_fechado: valorNumerico,
      numero_proposta: numeroProposta.trim(),
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
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 mb-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
          <DialogTitle className="text-lg font-bold text-[#0C2D48]">
            Confirmar Fechamento (Oportunidade Ganha)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            A etapa de ganho foi concluída! A oportunidade {protocolo} passará para{' '}
            <strong className="text-emerald-800">"Ganha — em finalização"</strong>. Confirme os
            dados finais do fechamento:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {erro && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Seguradora / Operadora */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Seguradora / Operadora fechada
            </label>
            <select
              value={seguradoraId}
              onChange={(e) => setSeguradoraId(e.target.value)}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
            >
              <option value="">Selecione a seguradora/operadora...</option>
              {seguradoras.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.frente})
                </option>
              ))}
            </select>
          </div>

          {/* Valor Fechado */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Valor fechado (R$) <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">R$</span>
              <Input
                type="text"
                placeholder="0,00"
                value={valorFechadoStr}
                onChange={(e) => setValorFechadoStr(e.target.value)}
                className="h-9 pl-9 text-xs rounded-xl border-slate-200 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Exemplo: 1.250,00 ou 4.800,50</p>
          </div>

          {/* Nº da Proposta */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nº da proposta / apólice (Quiver) <span className="text-red-500 font-bold">*</span>
            </label>
            <Input
              type="text"
              placeholder="Digite o número da proposta ou apólice..."
              value={numeroProposta}
              onChange={(e) => setNumeroProposta(e.target.value)}
              className="h-9 text-xs rounded-xl border-slate-200 font-mono"
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
            className="rounded-xl text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold btn-press"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Salvando fechamento...
              </>
            ) : (
              'Confirmar Ganho'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
