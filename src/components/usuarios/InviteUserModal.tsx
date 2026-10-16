import React, { useState, useEffect } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserPlus, Loader2, AlertCircle } from 'lucide-react'
import { Equipe, UserPerfil, UserFuncao, InviteUserInput } from '@/types/usuarios'

interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipes: Equipe[]
  onInvite: (data: InviteUserInput) => Promise<{ success: boolean; error: string | null }>
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  open,
  onOpenChange,
  equipes,
  onInvite,
}) => {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [perfil, setPerfil] = useState<UserPerfil>('Colaborador')
  const [funcao, setFuncao] = useState<UserFuncao>('Comercial')
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset do form quando o modal abre
  useEffect(() => {
    if (open) {
      setNome('')
      setEmail('')
      setTelefone('')
      setPerfil('Colaborador')
      setFuncao('Comercial')
      // Por padrão seleciona a primeira equipe se disponível
      if (equipes.length > 0) {
        setSelectedEquipes([equipes[0].id])
      } else {
        setSelectedEquipes([])
      }
      setErrorMessage(null)
      setSubmitting(false)
    }
  }, [open, equipes])

  const toggleEquipe = (id: string) => {
    setSelectedEquipes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const trimmedNome = nome.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedTelefone = telefone.trim()

    if (!trimmedNome) {
      setErrorMessage('Informe o nome completo do usuário.')
      return
    }

    if (!trimmedEmail) {
      setErrorMessage('Informe o e-mail do usuário.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Digite um e-mail válido.')
      return
    }

    if (selectedEquipes.length === 0) {
      setErrorMessage('Selecione pelo menos uma equipe (Seguros e/ou Saúde e Odonto).')
      return
    }

    setSubmitting(true)
    try {
      const result = await onInvite({
        nome: trimmedNome,
        email: trimmedEmail,
        telefone: trimmedTelefone || undefined,
        perfil,
        funcao,
        equipeIds: selectedEquipes,
      })

      if (result.success) {
        onOpenChange(false)
      } else {
        setErrorMessage(result.error || 'Não foi possível convidar o usuário. Tente novamente.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar convite.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-teal-700 mb-2">
            <UserPlus className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-[#0C2D48]">
            Convidar usuário
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            O novo usuário receberá um convite por e-mail para definir sua senha de acesso.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-nome" className="text-xs font-semibold text-slate-700">
              Nome completo <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="invite-nome"
              placeholder="Ex.: Carlos Eduardo Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={submitting}
              className="h-10 rounded-xl text-sm"
              autoFocus
            />
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs font-semibold text-slate-700">
              E-mail corporativo <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="carlos@corretorang.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="h-10 rounded-xl text-sm"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="invite-telefone" className="text-xs font-semibold text-slate-700">
              Telefone / WhatsApp <span className="text-slate-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="invite-telefone"
              placeholder="(13) 99876-5432"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={submitting}
              className="h-10 rounded-xl text-sm"
            />
          </div>

          {/* Linha dupla: Perfil de acesso + Função */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Perfil de acesso */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Perfil de acesso</Label>
              <Select
                value={perfil}
                onValueChange={(val) => setPerfil(val as UserPerfil)}
                disabled={submitting}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Gestor">Gestor</SelectItem>
                  <SelectItem value="Colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Função */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Função</Label>
              <Select
                value={funcao}
                onValueChange={(val) => setFuncao(val as UserFuncao)}
                disabled={submitting}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Pós-venda">Pós-venda</SelectItem>
                  <SelectItem value="Gestão">Gestão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Equipes vinculadas (pode marcar Seguros e/ou Saúde e Odonto) */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-semibold text-slate-700">
              Equipes de atuação <span className="text-rose-500">*</span>
            </Label>
            <p className="text-[11px] text-slate-500">
              Selecione uma ou ambas as equipes às quais o usuário pertencerá.
            </p>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50/50">
              {equipes.map((equipe) => {
                const isChecked = selectedEquipes.includes(equipe.id)
                return (
                  <label
                    key={equipe.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleEquipe(equipe.id)}
                      disabled={submitting}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-800">{equipe.nome}</span>
                      {equipe.descricao && (
                        <span className="text-[10px] text-slate-500">{equipe.descricao}</span>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 rounded-xl text-xs font-semibold text-slate-700"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-[#00A896] hover:bg-[#008f80] text-white font-semibold text-xs flex items-center gap-2 btn-press"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando convite...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enviar convite</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default InviteUserModal
