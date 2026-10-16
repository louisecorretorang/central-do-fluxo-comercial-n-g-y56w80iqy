import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, UserCheck, UserX, Loader2 } from 'lucide-react'
import { UserProfile } from '@/types/usuarios'

interface ToggleStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
  loading: boolean
  onConfirm: () => void
}

export const ToggleStatusDialog: React.FC<ToggleStatusDialogProps> = ({
  open,
  onOpenChange,
  user,
  loading,
  onConfirm,
}) => {
  if (!user) return null

  const isActivating = user.situacao === 'inativo'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px] rounded-2xl p-6">
        <AlertDialogHeader className="text-left">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center mb-2 ${
              isActivating
                ? 'bg-teal-50 border border-teal-200 text-teal-700'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            {isActivating ? <UserCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
          </div>
          <AlertDialogTitle className="text-lg font-bold text-[#0C2D48]">
            {isActivating ? 'Reativar acesso de usuário?' : 'Desativar usuário?'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-slate-500 leading-relaxed pt-1">
            {isActivating ? (
              <>
                O usuário <strong className="text-slate-700">{user.nome}</strong> ({user.email})
                voltará a ter acesso normal à Central do Fluxo Comercial N&amp;G.
              </>
            ) : (
              <>
                O usuário <strong className="text-slate-700">{user.nome}</strong> ({user.email}){' '}
                <span className="text-rose-600 font-semibold">não conseguirá mais entrar</span> no
                sistema. O histórico de atendimentos e dados permanecerão preservados.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="pt-3 gap-2 sm:gap-2">
          <AlertDialogCancel
            disabled={loading}
            className="h-10 rounded-xl text-xs font-semibold text-slate-700"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={loading}
            className={`h-10 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 btn-press ${
              isActivating ? 'bg-[#00A896] hover:bg-[#008f80]' : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <span>{isActivating ? 'Sim, reativar usuário' : 'Sim, desativar usuário'}</span>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
export default ToggleStatusDialog
