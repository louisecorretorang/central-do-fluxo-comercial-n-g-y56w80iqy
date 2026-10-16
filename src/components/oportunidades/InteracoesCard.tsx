import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Phone,
  MessageCircle,
  Mail,
  Users,
  MoreHorizontal,
  Plus,
  Calendar,
  User,
  Clock,
  Sparkles,
  Inbox,
  Loader2,
} from 'lucide-react'
import { OportunidadeInteracao, InteracaoTipo } from '@/types/oportunidades'
import { createInteracao } from '@/services/oportunidades'
import { formatDateBR } from '@/components/NewOpportunityModal'

interface InteracoesCardProps {
  oportunidadeId: string
  usuarioId: string
  interacoes: OportunidadeInteracao[]
  onInteracaoCriada: (nova: OportunidadeInteracao) => void
}

const TIPOS_INTERACAO: {
  tipo: InteracaoTipo
  icon: React.ElementType
  color: string
  bg: string
}[] = [
  { tipo: 'Ligação', icon: Phone, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  {
    tipo: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
  },
  { tipo: 'E-mail', icon: Mail, color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  { tipo: 'Reunião', icon: Users, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  {
    tipo: 'Outro',
    icon: MoreHorizontal,
    color: 'text-slate-700',
    bg: 'bg-slate-50 border-slate-200',
  },
]

export function InteracoesCard({
  oportunidadeId,
  usuarioId,
  interacoes,
  onInteracaoCriada,
}: InteracoesCardProps) {
  const [modalAberto, setModalAberto] = useState(false)
  const [tipo, setTipo] = useState<InteracaoTipo>('WhatsApp')
  const [dataContato, setDataContato] = useState<string>(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  })
  const [resumo, setResumo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resumo.trim()) {
      setErro('Informe o resumo do contato.')
      return
    }

    setSalvando(true)
    setErro(null)

    try {
      const dataHoraIso = new Date(`${dataContato}T12:00:00Z`).toISOString()
      const res = await createInteracao({
        oportunidade_id: oportunidadeId,
        tipo,
        data_contato: dataHoraIso,
        resumo: resumo.trim(),
        registrado_por: usuarioId,
      })

      if (res.error || !res.data) {
        throw new Error(res.error || 'Não foi possível registrar o contato.')
      }

      onInteracaoCriada(res.data)
      setResumo('')
      setModalAberto(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao registrar contato.'
      setErro(msg)
    } finally {
      setSalvando(false)
    }
  }

  const getTipoConfig = (tipoNome: InteracaoTipo) => {
    return TIPOS_INTERACAO.find((t) => t.tipo === tipoNome) || TIPOS_INTERACAO[4]
  }

  return (
    <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-[#0C2D48]">
                Interações com o cliente
              </CardTitle>
              <Badge className="bg-slate-100 text-slate-700 border-none text-xs font-semibold">
                {interacoes.length} {interacoes.length === 1 ? 'registro' : 'registros'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Histórico de contatos realizados (da mais recente para a mais antiga)
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            setErro(null)
            setModalAberto(true)
          }}
          className="h-9 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs btn-press"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Registrar contato
        </Button>
      </CardHeader>

      <CardContent className="p-5 sm:p-6">
        {interacoes.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-slate-50/50 border border-dashed border-slate-200">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhum contato registrado ainda</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Clique no botão acima para anotar ligações, mensagens de WhatsApp, e-mails ou reuniões
              com o cliente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interacoes.map((item) => {
              const cfg = getTipoConfig(item.tipo)
              const IconComp = cfg.icon
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors shadow-2xs flex items-start gap-3.5"
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg} ${cfg.color}`}
                  >
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{item.tipo}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDateBR(item.data_contato)}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {item.registrado_por_nome || 'Equipe'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-1.5 whitespace-pre-wrap leading-relaxed">
                      {item.resumo}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Registrar Contato */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0C2D48]">
              Registrar contato com o cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Anote o resumo do alinhamento ou conversa realizada para o time acompanhar o
              andamento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvar} className="space-y-4 py-2">
            {erro && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                {erro}
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                Tipo de contato
              </Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TIPOS_INTERACAO.map((t) => {
                  const IconComp = t.icon
                  const selecionado = tipo === t.tipo
                  return (
                    <button
                      key={t.tipo}
                      type="button"
                      onClick={() => setTipo(t.tipo)}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                        selecionado
                          ? 'border-teal-600 bg-teal-50/80 text-teal-900 font-bold ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <IconComp
                        className={`w-4 h-4 ${selecionado ? 'text-teal-700' : 'text-slate-500'}`}
                      />
                      <span>{t.tipo}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label
                htmlFor="dataContato"
                className="text-xs font-semibold text-slate-700 mb-1 block"
              >
                Data do contato
              </Label>
              <Input
                id="dataContato"
                type="date"
                value={dataContato}
                onChange={(e) => setDataContato(e.target.value)}
                required
                className="h-10 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div>
              <Label htmlFor="resumo" className="text-xs font-semibold text-slate-700 mb-1 block">
                Resumo da conversa / alinhamento
              </Label>
              <Textarea
                id="resumo"
                value={resumo}
                onChange={(e) => setResumo(e.target.value)}
                placeholder="Ex.: Cliente confirmou interesse na proposta da seguradora Porto. Aguardando envio do cartão CNPJ atualizado até quinta-feira."
                rows={4}
                required
                className="text-xs rounded-xl border-slate-200 focus-visible:ring-teal-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Lembre-se: não registre informações médicas nem dados sensíveis de saúde.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
                className="h-9 rounded-xl border-slate-200 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando}
                className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Salvando...
                  </>
                ) : (
                  'Salvar contato'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
