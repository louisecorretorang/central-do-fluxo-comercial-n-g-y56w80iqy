import React, { useState, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CheckSquare,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  Sparkles,
} from 'lucide-react'
import { OportunidadeEtapa, OportunidadeChecklistItem } from '@/types/oportunidades'
import {
  updateChecklistItem,
  uploadChecklistAnexo,
  getDownloadAnexoUrl,
  concluirEtapaOportunidade,
  assumirEtapaOportunidade,
} from '@/services/oportunidades'
import { formatDateBR, formatCurrencyBRL } from '@/components/NewOpportunityModal'
import { UserPerfil, UserFuncao } from '@/types/usuarios'

interface ChecklistEtapaAtualProps {
  oportunidadeId: string
  etapaAtual: OportunidadeEtapa | null
  todasEtapas: OportunidadeEtapa[]
  usuarioId: string
  usuarioNome: string
  userPerfil?: UserPerfil | null
  userFuncao?: UserFuncao | null
  userEquipeIds?: string[]
  bloqueadoMovimento?: boolean
  onAbrirModalVoltar?: () => void
  onAbrirModalGanho?: () => void
  onAtualizacao: () => void
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChecklistEtapaAtual({
  oportunidadeId,
  etapaAtual,
  todasEtapas,
  usuarioId,
  usuarioNome,
  userPerfil,
  userFuncao,
  userEquipeIds = [],
  bloqueadoMovimento = false,
  onAbrirModalVoltar,
  onAbrirModalGanho,
  onAtualizacao,
}: ChecklistEtapaAtualProps) {
  const [salvandoItemId, setSalvandoItemId] = useState<string | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [baixandoItemId, setBaixandoItemId] = useState<string | null>(null)
  const [concluindo, setConcluindo] = useState(false)
  const [assumindo, setAssumindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  // Estados locais para inputs para digitação suave
  const [valoresLocais, setValoresLocais] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  if (!etapaAtual) {
    return (
      <Card className="border border-slate-200/80 bg-white rounded-2xl shadow-xs p-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
        <h3 className="text-base font-bold text-[#0C2D48]">Todas as etapas concluídas</h3>
        <p className="text-xs text-slate-500 mt-1">
          O fluxo desta oportunidade foi cumprido com êxito.
        </p>
      </Card>
    )
  }

  // Verifica se todos os itens OBRIGATÓRIOS da etapa atual foram preenchidos / concluídos
  // Para 'Documento': conta como preenchido quando tiver PELO MENOS UM arquivo
  const obrigatorios = etapaAtual.itens.filter((i) => i.obrigatorio)
  const obrigatoriosConcluidos = obrigatorios.filter((i) => {
    if (i.tipo === 'Confirmação') return i.concluido
    if (i.tipo === 'Documento') {
      return (
        (i.documentos && i.documentos.length > 0) ||
        Boolean(i.arquivo_url && i.arquivo_url.trim().length > 0) ||
        i.concluido
      )
    }
    if (i.tipo === 'Informação') {
      const v = valoresLocais[i.id] !== undefined ? valoresLocais[i.id] : i.valor
      return Boolean(v && String(v).trim().length > 0)
    }
    return i.concluido
  })
  const todosObrigatoriosProntos =
    obrigatorios.length === 0 || obrigatoriosConcluidos.length === obrigatorios.length

  // Salvar campo de Informação (ao perder foco ou pressionar Enter)
  const handleSalvarInformacao = async (item: OportunidadeChecklistItem, valor: string) => {
    const limpo = valor.trim()
    const estaConcluido = limpo.length > 0

    setSalvandoItemId(item.id)
    setErro(null)

    const res = await updateChecklistItem({
      item_id: item.id,
      oportunidade_id: oportunidadeId,
      etapa_nome: etapaAtual.nome,
      titulo: item.titulo,
      valor: limpo,
      concluido: estaConcluido,
      usuario_id: usuarioId,
    })

    setSalvandoItemId(null)
    if (res.error) {
      setErro(`Erro ao salvar "${item.titulo}": ${res.error}`)
    } else {
      onAtualizacao()
    }
  }

  // Salvar Confirmação (Checkbox)
  const handleToggleConfirmacao = async (item: OportunidadeChecklistItem, novoValor: boolean) => {
    setSalvandoItemId(item.id)
    setErro(null)

    const res = await updateChecklistItem({
      item_id: item.id,
      oportunidade_id: oportunidadeId,
      etapa_nome: etapaAtual.nome,
      titulo: item.titulo,
      valor: novoValor ? 'Confirmado' : null,
      concluido: novoValor,
      usuario_id: usuarioId,
    })

    setSalvandoItemId(null)
    if (res.error) {
      setErro(`Erro ao atualizar "${item.titulo}": ${res.error}`)
    } else {
      onAtualizacao()
    }
  }

  // Upload de Documento
  const handleFileChange = async (
    item: OportunidadeChecklistItem,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingItemId(item.id)
    setErro(null)

    const res = await uploadChecklistAnexo({
      oportunidade_id: oportunidadeId,
      etapa_id: etapaAtual.id,
      item_id: item.id,
      titulo: item.titulo,
      file,
      usuario_id: usuarioId,
    })

    setUploadingItemId(null)
    if (res.error) {
      setErro(`Erro ao anexar arquivo: ${res.error}`)
    } else {
      setSucesso(`Arquivo "${file.name}" anexado com sucesso!`)
      setTimeout(() => setSucesso(null), 4000)
      onAtualizacao()
    }
  }

  // Download seguro de documento privado via URL assinada (por arquivo_caminho ou item legado)
  const handleBaixarDocumentoPorCaminho = async (caminho: string, itemId: string) => {
    if (!caminho) return

    setBaixandoItemId(itemId)
    setErro(null)

    const res = await getDownloadAnexoUrl(caminho)
    setBaixandoItemId(null)

    if (res.error || !res.url) {
      setErro(`Erro ao obter arquivo: ${res.error || 'URL inválida'}`)
    } else {
      window.open(res.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleBaixarDocumento = async (item: OportunidadeChecklistItem) => {
    if (!item.arquivo_url) return
    return handleBaixarDocumentoPorCaminho(item.arquivo_url, item.id)
  }

  // Lista dos nomes dos itens que faltam preencher (se houver pendências)
  const itensFaltantes = obrigatorios
    .filter((i) => !obrigatoriosConcluidos.some((c) => c.id === i.id))
    .map((i) => i.titulo)

  // Checar se o usuário atual pode assumir esta etapa (quando em fila_equipe)
  const podeAssumir =
    etapaAtual &&
    etapaAtual.responsavel_tipo === 'fila_equipe' &&
    etapaAtual.responsavel_usuario_id !== usuarioId &&
    (userPerfil === 'Administrador' ||
      (etapaAtual.equipe_id &&
        userEquipeIds.includes(etapaAtual.equipe_id) &&
        (!etapaAtual.funcao || etapaAtual.funcao === userFuncao)))

  const handleAssumirEtapa = async () => {
    setAssumindo(true)
    setErro(null)

    const res = await assumirEtapaOportunidade({
      oportunidade_id: oportunidadeId,
      etapa_id: etapaAtual.id,
    })

    setAssumindo(false)
    if (res.error) {
      setErro(`Não foi possível assumir a etapa: ${res.error}`)
    } else {
      setSucesso('Você assumiu a responsabilidade desta etapa!')
      setTimeout(() => setSucesso(null), 4000)
      onAtualizacao()
    }
  }

  // Concluir etapa atual
  const handleConcluirEtapa = async () => {
    if (!todosObrigatoriosProntos) {
      setErro(`Falta preencher os seguintes itens obrigatórios: ${itensFaltantes.join(', ')}`)
      return
    }

    setConcluindo(true)
    setErro(null)

    const res = await concluirEtapaOportunidade({
      oportunidade_id: oportunidadeId,
      etapa_atual_id: etapaAtual.id,
    })

    setConcluindo(false)
    if (res.error) {
      setErro(res.error)
    } else {
      onAtualizacao()
      // Se era etapa de ganho, abre o modal de confirmação de ganho
      if (res.data?.era_etapa_ganho && onAbrirModalGanho) {
        onAbrirModalGanho()
      } else if (res.data?.era_ultima_etapa) {
        setSucesso('Última etapa concluída! Oportunidade finalizada com sucesso.')
        setTimeout(() => setSucesso(null), 5000)
      } else {
        setSucesso('Etapa concluída e fluxo avançado com sucesso!')
        setTimeout(() => setSucesso(null), 4000)
      }
    }
  }

  return (
    <Card className="border-2 border-teal-500/80 bg-white rounded-2xl shadow-md overflow-hidden">
      <CardHeader className="p-5 sm:p-6 pb-4 border-b border-teal-100 bg-teal-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {etapaAtual.ordem}
            </span>
            <CardTitle className="text-lg font-bold text-[#0C2D48]">
              Checklist da etapa atual: {etapaAtual.nome}
            </CardTitle>
            <Badge className="bg-teal-600 text-white text-xs font-semibold">
              Etapa em andamento
            </Badge>
          </div>

          <p className="text-xs text-slate-600 mt-1">
            Preencha os itens solicitados para liberar o avanço do fluxo. Itens com{' '}
            <span className="text-red-500 font-bold">*</span> são obrigatórios.
          </p>
        </div>

        {/* Ações da Etapa Atual: Assumir, Voltar e Concluir Etapa */}
        <div className="flex flex-wrap items-center gap-2">
          {podeAssumir && !bloqueadoMovimento && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAssumirEtapa}
              disabled={assumindo}
              className="h-10 px-3.5 rounded-xl border-teal-300 text-teal-800 bg-white hover:bg-teal-50 text-xs font-bold btn-press shadow-2xs"
            >
              {assumindo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Assumindo...
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Assumir etapa
                </>
              )}
            </Button>
          )}

          {etapaAtual.ordem > 1 && onAbrirModalVoltar && !bloqueadoMovimento && (
            <Button
              type="button"
              variant="outline"
              onClick={onAbrirModalVoltar}
              disabled={concluindo || assumindo}
              className="h-10 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold btn-press shadow-2xs"
            >
              Voltar etapa
            </Button>
          )}

          {!bloqueadoMovimento && (
            <Button
              type="button"
              onClick={handleConcluirEtapa}
              disabled={concluindo}
              className={`h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-xs btn-press ${
                todosObrigatoriosProntos
                  ? 'bg-[#00A896] hover:bg-teal-700 text-white ring-2 ring-teal-500/30'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
              title={
                !todosObrigatoriosProntos
                  ? `Falta preencher: ${itensFaltantes.join(', ')}`
                  : 'Concluir esta etapa'
              }
            >
              {concluindo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Concluindo...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Concluir etapa
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-4">
        {erro && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {sucesso && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{sucesso}</span>
          </div>
        )}

        {/* Progresso de obrigatórios */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 font-medium">
            Obrigatórios concluídos:{' '}
            <strong className="text-teal-900">
              {obrigatoriosConcluidos.length} de {obrigatorios.length}
            </strong>
          </span>

          {todosObrigatoriosProntos ? (
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              Tudo pronto para concluir a etapa!
            </span>
          ) : (
            <span className="text-amber-800 font-medium">
              Falta preencher: <strong>{itensFaltantes.join(', ')}</strong>
            </span>
          )}
        </div>

        {/* Lista dos itens de checklist da etapa atual */}
        {etapaAtual.itens.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">
            Esta etapa não requer itens de checklist. Você já pode avançar.
          </p>
        ) : (
          <div className="space-y-3.5 pt-1">
            {etapaAtual.itens.map((item) => {
              const isUploading = uploadingItemId === item.id
              const isSaving = salvandoItemId === item.id
              const isBaixando = baixandoItemId === item.id

              const valorAtual =
                valoresLocais[item.id] !== undefined ? valoresLocais[item.id] : item.valor || ''

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    item.concluido
                      ? 'border-emerald-200 bg-emerald-50/25'
                      : item.obrigatorio
                        ? 'border-slate-300 bg-white shadow-2xs'
                        : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xs font-bold text-slate-400 font-mono mt-0.5">
                          {item.ordem}.
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                              {item.titulo}
                            </span>
                            {item.obrigatorio && (
                              <span
                                className="text-red-500 font-bold text-sm"
                                title="Item obrigatório"
                              >
                                *
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1 font-medium text-slate-600 border-slate-200 ml-1"
                            >
                              {item.tipo}
                            </Badge>
                          </div>

                          {/* ==============================================
                              CASO 1: DOCUMENTO (Múltiplos arquivos por item)
                             ============================================== */}
                          {item.tipo === 'Documento' && (
                            <div className="mt-3 space-y-2.5">
                              {/* Lista de arquivos do item */}
                              {item.documentos && item.documentos.length > 0 ? (
                                <div className="space-y-2">
                                  {item.documentos.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-slate-800 truncate">
                                            {doc.arquivo_nome}
                                          </p>
                                          <p className="text-[10px] text-slate-400">
                                            {formatBytes(doc.arquivo_tamanho)}
                                            {doc.enviado_em &&
                                              ` • Anexado em ${formatDateBR(doc.enviado_em)}`}
                                            {doc.enviado_por_nome && ` por ${doc.enviado_por_nome}`}
                                          </p>
                                        </div>
                                      </div>

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleBaixarDocumentoPorCaminho(
                                            doc.arquivo_caminho,
                                            doc.id,
                                          )
                                        }
                                        disabled={baixandoItemId === doc.id}
                                        className="h-8 px-2.5 rounded-lg border-teal-200 text-teal-800 hover:bg-teal-50 text-xs font-semibold btn-press"
                                      >
                                        {baixandoItemId === doc.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <>
                                            <Download className="w-3.5 h-3.5 mr-1" />
                                            Baixar
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              ) : item.arquivo_nome ? (
                                /* Fallback se tiver arquivo legado */
                                <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate">
                                        {item.arquivo_nome}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {formatBytes(item.arquivo_tamanho)}
                                        {item.concluido_em &&
                                          ` • Anexado em ${formatDateBR(item.concluido_em)}`}
                                        {item.concluido_por_nome &&
                                          ` por ${item.concluido_por_nome}`}
                                      </p>
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBaixarDocumento(item)}
                                    disabled={isBaixando}
                                    className="h-8 px-2.5 rounded-lg border-teal-200 text-teal-800 hover:bg-teal-50 text-xs font-semibold btn-press"
                                  >
                                    {isBaixando ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <Download className="w-3.5 h-3.5 mr-1" />
                                        Baixar
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ) : null}

                              {/* Botão Anexar (sempre adiciona um novo arquivo, nunca substitui) */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <input
                                  type="file"
                                  className="hidden"
                                  ref={(el) => {
                                    fileInputRefs.current[item.id] = el
                                  }}
                                  onChange={(e) => handleFileChange(item, e)}
                                />
                                <Button
                                  type="button"
                                  onClick={() => fileInputRefs.current[item.id]?.click()}
                                  disabled={isUploading}
                                  className="h-8 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold btn-press"
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                      Enviando arquivo...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                                      Anexar arquivo
                                    </>
                                  )}
                                </Button>
                                <span className="text-[11px] text-slate-400">
                                  Armazenado em ambiente privado seguro (permite múltiplos arquivos)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* ==============================================
                              CASO 2: INFORMAÇÃO (Texto, Número, Valor R$, Data, Sim/Não, Opções)
                             ============================================== */}
                          {item.tipo === 'Informação' && (
                            <div className="mt-2.5 max-w-md">
                              {/* Formato: sim_nao */}
                              {item.formato === 'sim_nao' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValoresLocais((p) => ({ ...p, [item.id]: 'Sim' }))
                                      handleSalvarInformacao(item, 'Sim')
                                    }}
                                    disabled={isSaving}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                      valorAtual === 'Sim'
                                        ? 'border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    Sim
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setValoresLocais((p) => ({ ...p, [item.id]: 'Não' }))
                                      handleSalvarInformacao(item, 'Não')
                                    }}
                                    disabled={isSaving}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                      valorAtual === 'Não'
                                        ? 'border-slate-700 bg-slate-100 text-slate-900 ring-2 ring-slate-400/20'
                                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                    }`}
                                  >
                                    Não
                                  </button>
                                  {isSaving && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  )}
                                </div>
                              )}

                              {/* Formato: opções */}
                              {item.formato === 'opções' &&
                                Array.isArray(item.opcoes) &&
                                item.opcoes.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={valorAtual}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        setValoresLocais((p) => ({ ...p, [item.id]: v }))
                                        handleSalvarInformacao(item, v)
                                      }}
                                      disabled={isSaving}
                                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-teal-500 focus:outline-none"
                                    >
                                      <option value="">Selecione uma opção...</option>
                                      {item.opcoes.map((opc) => (
                                        <option key={opc} value={opc}>
                                          {opc}
                                        </option>
                                      ))}
                                    </select>
                                    {isSaving && (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                    )}
                                  </div>
                                )}

                              {/* Formato: data */}
                              {item.formato === 'data' && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="date"
                                    value={valorAtual}
                                    onChange={(e) =>
                                      setValoresLocais((p) => ({ ...p, [item.id]: e.target.value }))
                                    }
                                    onBlur={() => handleSalvarInformacao(item, valorAtual)}
                                    disabled={isSaving}
                                    className="h-9 text-xs rounded-xl border-slate-200 max-w-xs"
                                  />
                                  {isSaving && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  )}
                                </div>
                              )}

                              {/* Formato: valor R$ */}
                              {item.formato === 'valor' && (
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-1 max-w-xs">
                                    <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">
                                      R$
                                    </span>
                                    <Input
                                      type="text"
                                      placeholder="0,00"
                                      value={valorAtual}
                                      onChange={(e) =>
                                        setValoresLocais((p) => ({
                                          ...p,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      onBlur={() => handleSalvarInformacao(item, valorAtual)}
                                      disabled={isSaving}
                                      className="h-9 pl-9 text-xs rounded-xl border-slate-200 font-mono"
                                    />
                                  </div>
                                  {isSaving && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  )}
                                </div>
                              )}

                              {/* Formato: número */}
                              {item.formato === 'número' && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Digite o número..."
                                    value={valorAtual}
                                    onChange={(e) =>
                                      setValoresLocais((p) => ({ ...p, [item.id]: e.target.value }))
                                    }
                                    onBlur={() => handleSalvarInformacao(item, valorAtual)}
                                    disabled={isSaving}
                                    className="h-9 text-xs rounded-xl border-slate-200 max-w-xs font-mono"
                                  />
                                  {isSaving && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  )}
                                </div>
                              )}

                              {/* Formato: texto padrão */}
                              {(!item.formato ||
                                (item.formato !== 'sim_nao' &&
                                  item.formato !== 'opções' &&
                                  item.formato !== 'data' &&
                                  item.formato !== 'valor' &&
                                  item.formato !== 'número')) && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="text"
                                    placeholder="Preencha a informação..."
                                    value={valorAtual}
                                    onChange={(e) =>
                                      setValoresLocais((p) => ({ ...p, [item.id]: e.target.value }))
                                    }
                                    onBlur={() => handleSalvarInformacao(item, valorAtual)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSalvarInformacao(item, valorAtual)
                                      }
                                    }}
                                    disabled={isSaving}
                                    className="h-9 text-xs rounded-xl border-slate-200"
                                  />
                                  {isSaving && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                                  )}
                                </div>
                              )}

                              {item.concluido_em && (
                                <p className="text-[10px] text-slate-400 mt-1">
                                  Preenchido em {formatDateBR(item.concluido_em)}
                                  {item.concluido_por_nome && ` por ${item.concluido_por_nome}`}
                                </p>
                              )}
                            </div>
                          )}

                          {/* ==============================================
                              CASO 3: CONFIRMAÇÃO (Caixa de marcar)
                             ============================================== */}
                          {item.tipo === 'Confirmação' && (
                            <div className="mt-2.5 flex items-center gap-2.5">
                              <Checkbox
                                id={`chk-${item.id}`}
                                checked={item.concluido}
                                onCheckedChange={(checked) =>
                                  handleToggleConfirmacao(item, Boolean(checked))
                                }
                                disabled={isSaving}
                                className="w-4 h-4 rounded border-slate-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                              />
                              <label
                                htmlFor={`chk-${item.id}`}
                                className="text-xs font-semibold text-slate-700 cursor-pointer select-none"
                              >
                                {item.concluido
                                  ? 'Item cumprido e confirmado'
                                  : 'Marcar como concluído'}
                              </label>

                              {isSaving && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600 ml-1" />
                              )}

                              {item.concluido && item.concluido_em && (
                                <span className="text-[10px] text-slate-400 ml-2">
                                  Confirmado em {formatDateBR(item.concluido_em)}
                                  {item.concluido_por_nome && ` por ${item.concluido_por_nome}`}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status de cumprimento do item */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                      {item.concluido ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Concluído
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-medium">
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
