import React from 'react'
import PageStateLayout from '@/components/PageStateLayout'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import { Briefcase } from 'lucide-react'

export default function Oportunidades() {
  const { openModal } = useOpportunityModal()

  return (
    <PageStateLayout
      title="Oportunidades"
      subtitle="Todas as negociações em andamento da Corretora N&G."
      icon={Briefcase}
      emptyMessage="Nenhuma oportunidade ainda — crie a primeira."
      actionLabel="Nova oportunidade"
      onAction={openModal}
      status="empty"
    />
  )
}
