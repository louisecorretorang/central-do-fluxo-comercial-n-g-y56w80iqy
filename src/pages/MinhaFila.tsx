import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { Inbox } from 'lucide-react'

export default function MinhaFila() {
  const navigate = useNavigate()

  return (
    <PageStateLayout
      title="Minha fila"
      subtitle="Acompanhe as oportunidades comerciais atribuídas ao seu atendimento."
      icon={Inbox}
      emptyMessage="Nenhuma oportunidade na sua fila — tudo em dia por aqui."
      actionLabel="Ver oportunidades"
      onAction={() => navigate('/oportunidades')}
      status="empty"
    />
  )
}
