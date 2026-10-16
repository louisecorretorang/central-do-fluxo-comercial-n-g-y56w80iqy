import React from 'react'
import PageStateLayout from '@/components/PageStateLayout'
import { useOpportunityModal } from '@/hooks/use-opportunity-modal'
import { Building2 } from 'lucide-react'

export default function Clientes() {
  const { openModal } = useOpportunityModal()

  return (
    <PageStateLayout
      title="Clientes"
      subtitle="Carteira de clientes e empresas parceiras da Nunes & Grossi."
      icon={Building2}
      emptyMessage="Nenhum cliente cadastrado ainda."
      actionLabel="Nova oportunidade"
      onAction={openModal}
      status="empty"
    />
  )
}
