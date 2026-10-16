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
import { UserCog, Loader2, AlertCircle } from 'lucide-react'
import { Equipe, UserPerfil, UserFuncao, UserProfile, UpdateUserInput } from '@/types/usuarios'

interface EditUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
  equipes: Equipe[]
  currentUserId?: string | null
  onUpdate: (data: UpdateUserInput) => Promise<{ success: boolean; error: string | null }>
}

export const EditUserModal: React.FC<EditUserModalProps> = ({
  open,
  onOpenChange,
  user,
  equipes,
  currentUserId,
  onUpdate,
}) => {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [perfil, setPerfil] = useState<UserPerfil>('Colaborador')
  const [funcao, setFuncao] = useState<UserFuncao>('Comercial')
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isSelf = Boolean(user && currentUserId && user.id === currentUserId)

  useEffect(() => {
    if (user && open) {
      setNome(user.nome || '')
      setTelefone(user.telefone || '')
      setPerfil(user.perfil || 'Colaborador')
      setFuncao(user.funcao || 'Comercial')
      const initialEquipes = (user.equipes || []).map((e) => e.id)
      setSelectedEquipes(initialEquipes)
      setErrorMessage(null)
      setSubmitting(false)
    }
  }, [user, open])

  const toggleEquipe = (id: string) => {
    setSelectedEquipes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErrorMessage(null)

    const trimmedNome = nome.trim()
    const trimmedTelefone = telefone.trim()

    if (!trimmedNome) {
      setErrorMessage('Informe o nome do usuário.')
      return
    }

    if (selectedEquipes.length === 0) {
      setErrorMessage('Selecione pelo menos uma equipe (Seguros e/ou Saúde e Odonto).')
      return
    }

    // Regra: Não pode mudar o próprio perfil para outro se for o usuário logado
    if (isSelf && perfil !== user.perfil) {
      setErrorMessage('Você não pode alterar seu próprio perfil de acesso.')
      return
    }

    setSubmitting(true)
    try {
      const result = await onUpdate({
        userId: user.id,
        nome: trimmedNome,
        telefone: trimmedTelefone || undefined,
        perfil,
        funcao,
        equipeIds: selectedEquipes,
      })

      if (result.success) {
        onOpenChange(false)
      } else {
        setErrorMessage(result.error || 'Não foi possível atualizar o usuário.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar dados.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left pb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/50 flex items-center justify-center text-teal-700 mb-2">
            <UserCog className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg sm:text-xl font-bold text-[#0C2D48]">
            Editar usuário
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Atualize perfil de acesso, equipes e função de {user.nome}.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* E-mail (somente leitura para integridade auth) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
            <Input
              value={user.email}
              disabled
              className="h-10 rounded-xl text-sm bg-slate-100/70 text-slate-600 cursor-not-allowed"
            />
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-nome" className="text-xs font-semibold text-slate-700">
              Nome completo <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={submitting}
              className="h-10 rounded-xl text-sm"
              autoFocus
            />
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-telefone" className="text-xs font-semibold text-slate-700">
              Telefone / WhatsApp
            </Label>
            <Input
              id="edit-telefone"
              placeholder="(13) 99876-5432"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              disabled={submitting}
              className="h-10 rounded-xl text-sm"
            />
          </div>

          {/* Linha dupla: Perfil + Função */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Perfil de acesso */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Perfil de acesso</Label>
                {isSelf && (
                  <span className="text-[10px] text-amber-600 font-medium">(sua conta)</span>
                )}
              </div>
              <Select
                value={perfil}
                onValueChange={(val) => setPerfil(val as UserPerfil)}
                disabled={submitting || isSelf}
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
              {isSelf && (
                <p className="text-[10px] text-slate-400">
                  Por segurança, você não pode alterar seu próprio perfil.
                </p>
              )}
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

          {/* Equipes vinculadas */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-semibold text-slate-700">
              Equipes de atuação <span className="text-rose-500">*</span>
            </Label>
            <p className="text-[11px] text-slate-500">
              O usuário pode atuar em uma ou em ambas as equipes.
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
              className="h-10 px-5 rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs flex items-center gap-2 btn-press"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar alterações</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default EditUserModal
