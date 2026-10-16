import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { KanbanSquare } from 'lucide-react'

export default function Quadro() {
  const navigate = useNavigate()

  return (
    <PageStateLayout
      title="Quadro"
      subtitle="Visualização em etapas de funil do fluxo de negociação."
      icon={KanbanSquare}
      emptyMessage="Nenhum card no quadro — arraste suas oportunidades aqui em breve."
      actionLabel="Ver oportunidades"
      onAction={() => navigate('/oportunidades')}
      status="empty"
    />
  )
}
