import React from 'react'
import PageStateLayout from '@/components/PageStateLayout'
import { Users2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Usuarios() {
  const { toast } = useToast()

  const handleInviteUser = () => {
    toast({
      title: 'Fluxo de convites',
      description: 'O convite de novos usuários será habilitado na próxima etapa do painel.',
    })
  }

  return (
    <PageStateLayout
      title="Usuários"
      subtitle="Equipe interna de consultores e gestores comerciais autorizados."
      icon={Users2}
      emptyMessage="Nenhum usuário convidado ainda."
      actionLabel="Convidar usuário"
      onAction={handleInviteUser}
      status="empty"
    />
  )
}
