import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import PageStateLayout from '@/components/PageStateLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Briefcase,
  ArrowLeft,
  Building2,
  AlertTriangle,
  User,
  ExternalLink,
  ShieldCheck,
  RotateCw,
  XCircle,
  Archive,
} from 'lucide-react'
import { getOportunidadeById } from '@/services/oportunidades'
import { OportunidadeDetalhe } from '@/types/oportunidades'
import { formatDateBR, formatCurrencyBRL } from '@/components/NewOpportunityModal'
import { formatCNPJ, formatCPF } from '@/lib/clientes-utils'
import { useAuth } from '@/hooks/use-auth'
import { TrilhaEtapas } from '@/components/oportunidades/TrilhaEtapas'
import { ChecklistEtapaAtual } from '@/components/oportunidades/ChecklistEtapaAtual'
import { InteracoesCard } from '@/components/oportunidades/InteracoesCard'
import { LinhaDoTempoCard } from '@/components/oportunidades/LinhaDoTempoCard'
import { QuiverCard } from '@/components/oportunidades/QuiverCard'
import { ModalVoltarEtapa } from '@/components/oportunidades/ModalVoltarEtapa'
import { ModalConfirmarGanho } from '@/components/oportunidades/ModalConfirmarGanho'
import { ModalMarcarPerdida } from '@/components/oportunidades/ModalMarcarPerdida'
import { ModalArquivarOportunidade } from '@/components/oportunidades/ModalArquivarOportunidade'
import { supabase } from '@/lib/supabase/client'

export default function OportunidadeDetalhes() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile, perfil, funcao, isAdmin, isGestor, userDisplayName } = useAuth()

  const [opp, setOpp] = useState<OportunidadeDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarregando, setRecarregando] = useState(false)
  const [userEquipeIds, setUserEquipeIds] = useState<string[]>([])

  // Modais de movimento
  const [modalVoltarAberto, setModalVoltarAberto] = useState(false)
  const [modalGanhoAberto, setModalGanhoAberto] = useState(false)
  const [modalPerdidaAberto, setModalPerdidaAberto] = useState(false)
  const [modalArquivarAberto, setModalArquivarAberto] = useState(false)

  const fetchOportunidade = useCallback(
    async (silencioso = false) => {
      if (!id) return
      if (!silencioso) setLoading(true)
      else setRecarregando(true)
      setError(null)

      try {
        const res = await getOportunidadeById(id)
        if (res.error || !res.data) {
          throw new Error(res.error || 'Oportunidade não encontrada.')
        }
        setOpp(res.data)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao buscar oportunidade.'
        setError(msg)
      } finally {
        setLoading(false)
        setRecarregando(false)
      }
    },
    [id],
  )

  useEffect(() => {
    fetchOportunidade()
  }, [fetchOportunidade])

  // Carregar equipes do usuário autenticado para checar permissão em fila_equipe
  useEffect(() => {
    if (!user?.id) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any
    client
      .from('profile_equipes')
      .select('equipe_id')
      .eq('profile_id', user.id)
      .then((res: any) => {
        if (res.data) {
          setUserEquipeIds(res.data.map((r: any) => r.equipe_id))
        }
      })
  }, [user?.id])

  if (loading && !opp) {
    return (
      <PageStateLayout
        title="Ficha da oportunidade"
        subtitle="Carregando dados da negociação, checklist e histórico..."
        icon={Briefcase}
        emptyMessage=""
        status="loading"
      />
    )
  }

  if (error || !opp) {
    return (
      <PageStateLayout
        title="Oportunidade não encontrada"
        subtitle="A negociação solicitada não existe ou você não tem acesso."
        icon={Briefcase}
        emptyMessage="Não foi possível carregar as informações desta oportunidade."
        actionLabel="Voltar para Oportunidades"
        onAction={() => navigate('/oportunidades')}
        status="error"
        onRetry={() => fetchOportunidade(false)}
      />
    )
  }

  const docFormatado =
    opp.cliente_tipo === 'PJ' ? formatCNPJ(opp.cliente_documento) : formatCPF(opp.cliente_documento)

  // Identificar objeto da etapa atual
  const etapaAtual = opp.etapas.find((e) => e.id === opp.etapa_atual_id) || null
  const currentUserId = user?.id || '00000000-0000-0000-0000-000000000000'

  // Identificar etapa anterior (para o modal de voltar etapa)
  const etapasOrdenadas = [...opp.etapas].sort((a, b) => a.ordem - b.ordem)
  const idxEtapaAtual = etapaAtual ? etapasOrdenadas.findIndex((e) => e.id === etapaAtual.id) : -1
  const etapaAnterior = idxEtapaAtual > 0 ? etapasOrdenadas[idxEtapaAtual - 1] : null

  // Regra de estados bloqueados de movimento (Perdida, Arquivada ou Concluída)
  const bloqueadoMovimento =
    opp.situacao === 'Perdida' || opp.situacao === 'Arquivada' || opp.situacao === 'Concluída'

  // Perfil pode arquivar? Administrador ou Gestor
  const podeArquivar = (isAdmin || isGestor) && opp.situacao !== 'Arquivada'

  // Cor do badge de situação no topo
  const getBadgeSituacaoClass = () => {
    switch (opp.situacao) {
      case 'Em andamento':
        return 'bg-blue-50 text-blue-800 border-blue-200'
      case 'Ganha — em finalização':
        return 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
      case 'Ganha':
      case 'Concluída':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200'
      case 'Perdida':
        return 'bg-rose-50 text-rose-800 border-rose-200'
      case 'Arquivada':
        return 'bg-slate-200 text-slate-800 border-slate-300'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ========================================================
          BARRA DE TOPO COM VOLTAR, SITUAÇÃO E AÇÕES
         ======================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/oportunidades"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors btn-press"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para lista de oportunidades</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {recarregando && (
            <span className="text-xs text-slate-400 flex items-center gap-1 animate-pulse">
              <RotateCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              Atualizando...
            </span>
          )}

          <Badge className={`text-xs px-3 py-1 font-semibold border ${getBadgeSituacaoClass()}`}>
            Situação: {opp.situacao}
          </Badge>

          {/* Botão "Marcar como perdida" disponível enquanto em andamento / não finalizada */}
          {opp.situacao === 'Em andamento' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalPerdidaAberto(true)}
              className="h-8 px-3 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 text-xs font-semibold btn-press shadow-2xs"
            >
              <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
              Marcar como perdida
            </Button>
          )}

          {/* Botão "Arquivar" restrito a Administrador e Gestor */}
          {podeArquivar && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalArquivarAberto(true)}
              className="h-8 px-3 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold btn-press shadow-2xs"
            >
              <Archive className="w-3.5 h-3.5 mr-1 text-slate-600" />
              Arquivar
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================
          AVISO QUANDO USOU FLUXO GENÉRICO
         ======================================================== */}
      {opp.usou_fluxo_generico && (
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-3 text-amber-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-sm text-amber-950">Aviso sobre o fluxo aplicado</h4>
            <p className="text-amber-900 leading-relaxed">
              Este produto ainda não tem um fluxo próprio cadastrado; usamos o fluxo padrão genérico
              da corretora.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================
          CABEÇALHO DA FICHA DA OPORTUNIDADE
          Protocolo, cliente com link, produto, seguradora,
          responsável comercial, valor estimado, data prevista,
          situação e etapa atual
         ======================================================== */}
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0C2D48] text-white flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-xs">
              <Briefcase className="w-7 h-7 text-teal-300" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-900 font-bold tracking-wider">
                  {opp.protocolo}
                </span>
                <Badge className="bg-slate-100 text-slate-800 border-none text-xs px-2.5 py-0.5 font-semibold">
                  Versão {opp.fluxo_versao} do fluxo
                </Badge>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-[#0C2D48] tracking-tight mt-1 truncate">
                {opp.produto_nome}
                {opp.seguradora_nome ? ` — ${opp.seguradora_nome}` : ''}
              </h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1">
                <Link
                  to={`/clientes/${opp.cliente_id}`}
                  className="font-semibold text-teal-700 hover:underline flex items-center gap-1.5"
                >
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>{opp.cliente_nome}</span>
                  <ExternalLink className="w-3 h-3 text-teal-500" />
                </Link>

                {docFormatado && <span className="font-mono text-slate-400">({docFormatado})</span>}

                <span className="text-slate-400">Criada em {formatDateBR(opp.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              asChild
              className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold btn-press shadow-2xs"
            >
              <Link to={`/clientes/${opp.cliente_id}`}>
                <Building2 className="w-4 h-4 mr-1.5 text-teal-600" />
                Ver ficha do cliente
              </Link>
            </Button>
          </div>
        </div>

        {/* Informações comerciais principais em Grid */}
        <CardContent className="p-5 sm:p-7">
          <h3 className="text-xs font-bold text-[#0C2D48] uppercase tracking-wider mb-4">
            Dados comerciais da negociação
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Valor estimado */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Valor estimado</span>
              <span className="font-bold text-teal-700 text-base mt-0.5 block font-mono">
                {formatCurrencyBRL(opp.valor_estimado)}
              </span>
            </div>

            {/* Data prevista */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Data prevista de fechamento</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {formatDateBR(opp.data_prevista_fechamento)}
              </span>
            </div>

            {/* Responsável comercial */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Responsável comercial</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {opp.responsavel_comercial_nome}
              </span>
            </div>

            {/* Origem */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Origem do lead</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.origem_nome}
              </span>
            </div>

            {/* Seguradora / Operadora */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Seguradora / Operadora</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.seguradora_nome || 'A definir na cotação'}
              </span>
            </div>

            {/* Frente */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 font-medium block">Frente de negócio</span>
              <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                {opp.produto_frente}
              </span>
            </div>

            {/* Etapa atual destacada */}
            <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 col-span-1 sm:col-span-2">
              <span className="text-teal-700 font-medium block">Etapa atual do fluxo</span>
              <span className="font-bold text-teal-950 text-sm mt-0.5 block">
                {etapaAtual ? etapaAtual.nome : opp.etapa_atual_nome || 'Fluxo concluído'}
              </span>
            </div>
          </div>

          {/* Observações */}
          {opp.observacoes && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs font-bold text-slate-700 block mb-1">Observações</span>
              <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                {opp.observacoes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========================================================
          CAMPO "Nº DA PROPOSTA/APÓLICE NO QUIVER"
         ======================================================== */}
      <QuiverCard
        oportunidadeId={opp.id}
        numeroQuiver={opp.numero_quiver || null}
        usuarioId={currentUserId}
        onAtualizacao={() => fetchOportunidade(true)}
      />

      {/* ========================================================
          TRILHA DE ETAPAS (Concluídas, Atual e Futuras)
         ======================================================== */}
      <TrilhaEtapas
        etapas={opp.etapas}
        etapaAtualId={opp.etapa_atual_id}
        responsavelComercialNome={opp.responsavel_comercial_nome}
        equipePadraoNome={opp.equipe_nome}
      />

      {/* ========================================================
          CHECKLIST DA ETAPA ATUAL (Interativo, Anexos privados,
          campos de Informação tipados, Confirmação, Concluir etapa,
          Voltar etapa e Assumir etapa em fila)
         ======================================================== */}
      <ChecklistEtapaAtual
        oportunidadeId={opp.id}
        etapaAtual={etapaAtual}
        todasEtapas={opp.etapas}
        usuarioId={currentUserId}
        usuarioNome={userDisplayName}
        userPerfil={perfil}
        userFuncao={funcao}
        userEquipeIds={userEquipeIds}
        bloqueadoMovimento={bloqueadoMovimento}
        onAbrirModalVoltar={() => setModalVoltarAberto(true)}
        onAbrirModalGanho={() => setModalGanhoAberto(true)}
        onAtualizacao={() => fetchOportunidade(true)}
      />

      {/* ========================================================
          GRID COM INTERAÇÕES (CONTATOS) E LINHA DO TEMPO
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contatos com o cliente */}
        <InteracoesCard
          oportunidadeId={opp.id}
          usuarioId={currentUserId}
          interacoes={opp.interacoes}
          onInteracaoCriada={() => fetchOportunidade(true)}
        />

        {/* Linha do tempo completa */}
        <LinhaDoTempoCard timeline={opp.timeline} />
      </div>

      {/* ========================================================
          MODAIS DE MOVIMENTO
         ======================================================== */}
      {/* 1. Modal Voltar Etapa */}
      {etapaAtual && etapaAnterior && (
        <ModalVoltarEtapa
          open={modalVoltarAberto}
          onOpenChange={setModalVoltarAberto}
          oportunidadeId={opp.id}
          etapaAtualId={etapaAtual.id}
          etapaAtualNome={etapaAtual.nome}
          etapaAnteriorNome={etapaAnterior.nome}
          onSucesso={() => fetchOportunidade(true)}
        />
      )}

      {/* 2. Modal Confirmar Ganho */}
      <ModalConfirmarGanho
        open={modalGanhoAberto}
        onOpenChange={setModalGanhoAberto}
        oportunidadeId={opp.id}
        protocolo={opp.protocolo}
        seguradoraIdAtual={opp.seguradora_id}
        valorEstimadoAtual={opp.valor_estimado}
        numeroQuiverAtual={opp.numero_quiver}
        onSucesso={() => fetchOportunidade(true)}
      />

      {/* 3. Modal Marcar Perdida */}
      <ModalMarcarPerdida
        open={modalPerdidaAberto}
        onOpenChange={setModalPerdidaAberto}
        oportunidadeId={opp.id}
        protocolo={opp.protocolo}
        onSucesso={() => fetchOportunidade(true)}
      />

      {/* 4. Modal Arquivar Oportunidade */}
      <ModalArquivarOportunidade
        open={modalArquivarAberto}
        onOpenChange={setModalArquivarAberto}
        oportunidadeId={opp.id}
        protocolo={opp.protocolo}
        onSucesso={() => fetchOportunidade(true)}
      />
    </div>
  )
}
