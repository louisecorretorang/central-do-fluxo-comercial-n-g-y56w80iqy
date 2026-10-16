import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { LayoutDashboard } from 'lucide-react'

export default function Painel() {
  const navigate = useNavigate()

  return (
    <PageStateLayout
      title="Painel"
      subtitle="Indicadores estratégicos, volume em R$ e metas do comercial."
      icon={LayoutDashboard}
      emptyMessage="Sem dados para exibir — os números aparecerão aqui."
      actionLabel="Ver oportunidades"
      onAction={() => navigate('/oportunidades')}
      status="empty"
    />
  )
}
