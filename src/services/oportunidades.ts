import { supabase } from '@/lib/supabase/client'
import {
  OportunidadeResumo,
  OportunidadeDetalhe,
  CriarOportunidadeInput,
  CriarOportunidadeResult,
  OportunidadeEtapa,
  OportunidadeChecklistItem,
} from '@/types/oportunidades'

// Helper seguro para queries flexíveis
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Cria uma nova oportunidade via RPC transacional abrir_oportunidade
 */
export async function createOportunidade(
  input: CriarOportunidadeInput,
): Promise<{ data: CriarOportunidadeResult | null; error: string | null }> {
  try {
    const { data, error } = await db.rpc('abrir_oportunidade', {
      p_cliente_id: input.cliente_id,
      p_produto_id: input.produto_id,
      p_seguradora_id: input.seguradora_id || null,
      p_responsavel_comercial_id: input.responsavel_comercial_id,
      p_origem_id: input.origem_id,
      p_valor_estimado: input.valor_estimado,
      p_data_prevista_fechamento: input.data_prevista_fechamento,
      p_observacoes: input.observacoes || null,
    })

    if (error) {
      console.error('Erro na RPC abrir_oportunidade:', error)
      return { data: null, error: error.message || 'Erro ao criar oportunidade.' }
    }

    return { data: data as CriarOportunidadeResult, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao processar abertura de oportunidade.'
    return { data: null, error: msg }
  }
}

/**
 * Busca todas as oportunidades para listagem com filtros e buscas
 */
export async function getOportunidades(options?: {
  clienteId?: string
  search?: string
}): Promise<{ data: OportunidadeResumo[] | null; error: string | null }> {
  try {
    let query = db
      .from('oportunidades')
      .select(`
        id,
        protocolo,
        cliente_id,
        produto_id,
        seguradora_id,
        fluxo_modelo_id,
        fluxo_versao,
        usou_fluxo_generico,
        equipe_id,
        responsavel_comercial_id,
        origem_id,
        valor_estimado,
        data_prevista_fechamento,
        observacoes,
        situacao,
        etapa_atual_id,
        criado_por,
        created_at,
        updated_at,
        cliente:clientes(id, tipo, razao_social, nome_completo, cnpj, cpf),
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome),
        responsavel:profiles!responsavel_comercial_id(id, nome, email),
        origem:origens_lead(id, nome),
        equipe:equipes(id, nome),
        etapa_atual:oportunidades_etapas!etapa_atual_id(id, nome)
      `)
      .order('created_at', { ascending: false })

    if (options?.clienteId) {
      query = query.eq('cliente_id', options.clienteId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar oportunidades:', error)
      return { data: null, error: error.message }
    }

    let items: OportunidadeResumo[] = (data || []).map((row: any) => {
      const clienteNome =
        row.cliente?.tipo === 'PJ'
          ? row.cliente?.razao_social || 'Razão Social não informada'
          : row.cliente?.nome_completo || 'Nome não informado'

      const clienteDoc = row.cliente?.tipo === 'PJ' ? row.cliente?.cnpj : row.cliente?.cpf

      return {
        id: row.id,
        protocolo: row.protocolo,
        cliente_id: row.cliente_id,
        cliente_nome: clienteNome,
        cliente_tipo: row.cliente?.tipo || 'PJ',
        cliente_documento: clienteDoc,
        produto_id: row.produto_id,
        produto_nome: row.produto?.nome || 'Produto não informado',
        produto_frente: row.produto?.frente || 'Seguros',
        seguradora_id: row.seguradora_id,
        seguradora_nome: row.seguradora?.nome || null,
        fluxo_modelo_id: row.fluxo_modelo_id,
        fluxo_versao: row.fluxo_versao,
        usou_fluxo_generico: Boolean(row.usou_fluxo_generico),
        equipe_id: row.equipe_id,
        equipe_nome: row.equipe?.nome || null,
        responsavel_comercial_id: row.responsavel_comercial_id,
        responsavel_comercial_nome: row.responsavel?.nome || 'Não atribuído',
        origem_id: row.origem_id,
        origem_nome: row.origem?.nome || 'Origem não informada',
        valor_estimado: Number(row.valor_estimado || 0),
        data_prevista_fechamento: row.data_prevista_fechamento,
        observacoes: row.observacoes,
        situacao: row.situacao,
        etapa_atual_id: row.etapa_atual_id,
        etapa_atual_nome: row.etapa_atual?.nome || null,
        criado_por: row.criado_por,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    if (options?.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase()
      items = items.filter(
        (opp) =>
          opp.protocolo.toLowerCase().includes(term) ||
          opp.cliente_nome.toLowerCase().includes(term) ||
          opp.produto_nome.toLowerCase().includes(term) ||
          (opp.seguradora_nome && opp.seguradora_nome.toLowerCase().includes(term)) ||
          opp.responsavel_comercial_nome.toLowerCase().includes(term),
      )
    }

    return { data: items, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao buscar oportunidades.'
    return { data: null, error: msg }
  }
}

/**
 * Busca uma oportunidade completa pelo ID, incluindo etapas e seus itens de checklist
 */
export async function getOportunidadeById(
  id: string,
): Promise<{ data: OportunidadeDetalhe | null; error: string | null }> {
  try {
    const { data: opp, error: oppError } = await db
      .from('oportunidades')
      .select(`
        id,
        protocolo,
        cliente_id,
        produto_id,
        seguradora_id,
        fluxo_modelo_id,
        fluxo_versao,
        usou_fluxo_generico,
        equipe_id,
        responsavel_comercial_id,
        origem_id,
        valor_estimado,
        data_prevista_fechamento,
        observacoes,
        situacao,
        etapa_atual_id,
        criado_por,
        created_at,
        updated_at,
        cliente:clientes(id, tipo, razao_social, nome_completo, cnpj, cpf, cidade, uf),
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome),
        responsavel:profiles!responsavel_comercial_id(id, nome, email),
        origem:origens_lead(id, nome),
        equipe:equipes(id, nome),
        etapa_atual:oportunidades_etapas!etapa_atual_id(id, nome)
      `)
      .eq('id', id)
      .single()

    if (oppError || !opp) {
      console.error('Erro ao buscar oportunidade:', oppError)
      return { data: null, error: oppError?.message || 'Oportunidade não encontrada' }
    }

    // Buscar etapas da oportunidade
    const { data: etapasData, error: etapasError } = await db
      .from('oportunidades_etapas')
      .select(`
        id,
        oportunidade_id,
        ordem,
        nome,
        descricao,
        tipo,
        responsavel_tipo,
        equipe_id,
        funcao,
        responsavel_usuario_id,
        prazo_dias,
        is_etapa_ganho,
        situacao,
        iniciada_em,
        concluida_em,
        created_at,
        updated_at,
        equipe:equipes(id, nome),
        responsavel_usuario:profiles!responsavel_usuario_id(id, nome, email)
      `)
      .eq('oportunidade_id', id)
      .order('ordem', { ascending: true })

    if (etapasError) {
      console.error('Erro ao buscar etapas da oportunidade:', etapasError)
      return { data: null, error: etapasError.message }
    }

    // Buscar itens de checklist de todas as etapas desta oportunidade
    const etapaIds = (etapasData || []).map((e: any) => e.id)
    let checklistMap: Record<string, OportunidadeChecklistItem[]> = {}

    if (etapaIds.length > 0) {
      const { data: itensData, error: itensError } = await db
        .from('oportunidades_checklist_itens')
        .select('*')
        .in('etapa_oportunidade_id', etapaIds)
        .order('ordem', { ascending: true })

      if (itensError) {
        console.error('Erro ao buscar checklist:', itensError)
      } else if (itensData) {
        checklistMap = (itensData as any[]).reduce(
          (acc, item) => {
            if (!acc[item.etapa_oportunidade_id]) {
              acc[item.etapa_oportunidade_id] = []
            }
            acc[item.etapa_oportunidade_id].push({
              id: item.id,
              etapa_oportunidade_id: item.etapa_oportunidade_id,
              ordem: item.ordem,
              titulo: item.titulo,
              tipo: item.tipo,
              formato: item.formato,
              opcoes: item.opcoes,
              obrigatorio: item.obrigatorio,
              valor: item.valor,
              concluido: item.concluido,
              concluido_por: item.concluido_por,
              concluido_em: item.concluido_em,
              created_at: item.created_at,
              updated_at: item.updated_at,
            })
            return acc
          },
          {} as Record<string, OportunidadeChecklistItem[]>,
        )
      }
    }

    const etapas: OportunidadeEtapa[] = (etapasData || []).map((e: any) => ({
      id: e.id,
      oportunidade_id: e.oportunidade_id,
      ordem: e.ordem,
      nome: e.nome,
      descricao: e.descricao,
      tipo: e.tipo,
      responsavel_tipo: e.responsavel_tipo,
      equipe_id: e.equipe_id,
      equipe_nome: e.equipe?.nome || null,
      funcao: e.funcao,
      responsavel_usuario_id: e.responsavel_usuario_id,
      responsavel_usuario_nome: e.responsavel_usuario?.nome || null,
      prazo_dias: e.prazo_dias,
      is_etapa_ganho: Boolean(e.is_etapa_ganho),
      situacao: e.situacao,
      iniciada_em: e.iniciada_em,
      concluida_em: e.concluida_em,
      itens: checklistMap[e.id] || [],
      created_at: e.created_at,
      updated_at: e.updated_at,
    }))

    const clienteNome =
      opp.cliente?.tipo === 'PJ'
        ? opp.cliente?.razao_social || 'Razão Social não informada'
        : opp.cliente?.nome_completo || 'Nome não informado'

    const clienteDoc = opp.cliente?.tipo === 'PJ' ? opp.cliente?.cnpj : opp.cliente?.cpf

    const detalhe: OportunidadeDetalhe = {
      id: opp.id,
      protocolo: opp.protocolo,
      cliente_id: opp.cliente_id,
      cliente_nome: clienteNome,
      cliente_tipo: opp.cliente?.tipo || 'PJ',
      cliente_documento: clienteDoc,
      produto_id: opp.produto_id,
      produto_nome: opp.produto?.nome || 'Produto não informado',
      produto_frente: opp.produto?.frente || 'Seguros',
      seguradora_id: opp.seguradora_id,
      seguradora_nome: opp.seguradora?.nome || null,
      fluxo_modelo_id: opp.fluxo_modelo_id,
      fluxo_versao: opp.fluxo_versao,
      usou_fluxo_generico: Boolean(opp.usou_fluxo_generico),
      equipe_id: opp.equipe_id,
      equipe_nome: opp.equipe?.nome || null,
      responsavel_comercial_id: opp.responsavel_comercial_id,
      responsavel_comercial_nome: opp.responsavel?.nome || 'Não atribuído',
      origem_id: opp.origem_id,
      origem_nome: opp.origem?.nome || 'Origem não informada',
      valor_estimado: Number(opp.valor_estimado || 0),
      data_prevista_fechamento: opp.data_prevista_fechamento,
      observacoes: opp.observacoes,
      situacao: opp.situacao,
      etapa_atual_id: opp.etapa_atual_id,
      etapa_atual_nome: opp.etapa_atual?.nome || null,
      criado_por: opp.criado_por,
      created_at: opp.created_at,
      updated_at: opp.updated_at,
      etapas,
    }

    return { data: detalhe, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao buscar detalhes da oportunidade.'
    return { data: null, error: msg }
  }
}
