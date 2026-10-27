import { supabase } from '@/lib/supabase/client'
import {
  OportunidadeResumo,
  OportunidadeDetalhe,
  CriarOportunidadeInput,
  CriarOportunidadeResult,
  OportunidadeEtapa,
  OportunidadeChecklistItem,
  OportunidadeInteracao,
  OportunidadeTimelineItem,
  InteracaoTipo,
  TimelineTipo,
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
  situacao?: string
  produtoId?: string
  seguradoraId?: string
  responsavelId?: string
  equipeId?: string
  dataInicio?: string
  dataFim?: string
  fluxoModeloId?: string
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
        numero_quiver,
        criado_por,
        created_at,
        updated_at,
        cliente:clientes(id, tipo, razao_social, nome_completo, cnpj, cpf),
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome),
        responsavel:profiles!responsavel_comercial_id(id, nome, email),
        origem:origens_lead(id, nome),
        equipe:equipes(id, nome),
        etapa_atual:oportunidades_etapas!etapa_atual_id(
          id,
          nome,
          ordem,
          responsavel_tipo,
          responsavel_usuario_id,
          equipe_id,
          funcao,
          iniciada_em,
          created_at
        )
      `)
      .order('created_at', { ascending: false })

    if (options?.clienteId) {
      query = query.eq('cliente_id', options.clienteId)
    }
    if (options?.situacao && options.situacao !== 'todas') {
      query = query.eq('situacao', options.situacao)
    }
    if (options?.produtoId && options.produtoId !== 'todos') {
      query = query.eq('produto_id', options.produtoId)
    }
    if (options?.seguradoraId && options.seguradoraId !== 'todas') {
      query = query.eq('seguradora_id', options.seguradoraId)
    }
    if (options?.responsavelId && options.responsavelId !== 'todos') {
      query = query.eq('responsavel_comercial_id', options.responsavelId)
    }
    if (options?.equipeId && options.equipeId !== 'todas') {
      query = query.eq('equipe_id', options.equipeId)
    }
    if (options?.fluxoModeloId) {
      query = query.eq('fluxo_modelo_id', options.fluxoModeloId)
    }
    if (options?.dataInicio) {
      query = query.gte('created_at', `${options.dataInicio}T00:00:00.000Z`)
    }
    if (options?.dataFim) {
      query = query.lte('created_at', `${options.dataFim}T23:59:59.999Z`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar oportunidades:', error)
      return { data: null, error: error.message }
    }

    const now = Date.now()
    const msInDay = 1000 * 60 * 60 * 24

    let items: OportunidadeResumo[] = (data || []).map((row: any) => {
      const clienteNome =
        row.cliente?.tipo === 'PJ'
          ? row.cliente?.razao_social || 'Razão Social não informada'
          : row.cliente?.nome_completo || 'Nome não informado'

      const clienteDoc = row.cliente?.tipo === 'PJ' ? row.cliente?.cnpj : row.cliente?.cpf

      const etapa = row.etapa_atual
      // Cálculo de dias na etapa atual:
      // se iniciada_em existir, usa iniciada_em; senão usa created_at da etapa ou da oportunidade
      const inicioEtapaStr = etapa?.iniciada_em || etapa?.created_at || row.created_at
      const inicioEtapaTime = inicioEtapaStr ? new Date(inicioEtapaStr).getTime() : now
      const diasNaEtapa = Math.max(0, Math.floor((now - inicioEtapaTime) / msInDay))

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
        etapa_atual_nome: etapa?.nome || null,
        etapa_atual_ordem: etapa?.ordem ?? null,
        etapa_atual_responsavel_tipo: etapa?.responsavel_tipo || null,
        etapa_atual_responsavel_usuario_id: etapa?.responsavel_usuario_id || null,
        etapa_atual_equipe_id: etapa?.equipe_id || null,
        etapa_atual_funcao: etapa?.funcao || null,
        etapa_atual_iniciada_em: etapa?.iniciada_em || null,
        dias_na_etapa: diasNaEtapa,
        numero_quiver: row.numero_quiver || null,
        criado_por: row.criado_por,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })

    if (options?.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase()
      const termDigits = options.search.replace(/\D/g, '')

      items = items.filter((opp) => {
        const docDigits = (opp.cliente_documento || '').replace(/\D/g, '')
        const matchesDoc = termDigits && docDigits.includes(termDigits)

        return (
          opp.protocolo.toLowerCase().includes(term) ||
          opp.cliente_nome.toLowerCase().includes(term) ||
          opp.produto_nome.toLowerCase().includes(term) ||
          (opp.seguradora_nome && opp.seguradora_nome.toLowerCase().includes(term)) ||
          opp.responsavel_comercial_nome.toLowerCase().includes(term) ||
          matchesDoc
        )
      })
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
        valor_fechado,
        motivo_perda_id,
        observacao_perda,
        data_prevista_fechamento,
        observacoes,
        situacao,
        etapa_atual_id,
        numero_quiver,
        criado_por,
        created_at,
        updated_at,
        cliente:clientes(id, tipo, razao_social, nome_completo, cnpj, cpf, cidade, uf),
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome),
        responsavel:profiles!responsavel_comercial_id(id, nome, email),
        criador:profiles!criado_por(id, nome, email),
        origem:origens_lead(id, nome),
        motivo_perda:motivos!motivo_perda_id(id, nome),
        equipe:equipes(id, nome),
        etapa_atual:oportunidades_etapas!etapa_atual_id(id, nome, ordem, situacao, concluida_em, responsavel_usuario_id)
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
        concluida_por_id,
        prazo_dias,
        is_etapa_ganho,
        situacao,
        iniciada_em,
        concluida_em,
        created_at,
        updated_at,
        equipe:equipes(id, nome),
        responsavel_usuario:profiles!responsavel_usuario_id(id, nome, email),
        concluido_por_usuario:profiles!concluida_por_id(id, nome, email)
      `)
      .eq('oportunidade_id', id)
      .order('ordem', { ascending: true })

    if (etapasError) {
      console.error('Erro ao buscar etapas da oportunidade:', etapasError)
      return { data: null, error: etapasError.message }
    }

    // Buscar itens de checklist de todas as etapas desta oportunidade e documentos
    const etapaIds = (etapasData || []).map((e: any) => e.id)
    let checklistMap: Record<string, OportunidadeChecklistItem[]> = {}

    if (etapaIds.length > 0) {
      const [itensRes, docsRes] = await Promise.all([
        db
          .from('oportunidades_checklist_itens')
          .select(`
            *,
            concluido_usuario:profiles!concluido_por(id, nome)
          `)
          .in('etapa_oportunidade_id', etapaIds)
          .order('ordem', { ascending: true }),
        db
          .from('oportunidades_documentos')
          .select(`
            id,
            oportunidade_id,
            checklist_item_id,
            arquivo_nome,
            arquivo_caminho,
            arquivo_tamanho,
            enviado_por,
            enviado_em,
            created_at,
            enviado_usuario:profiles!enviado_por(id, nome)
          `)
          .eq('oportunidade_id', id)
          .order('created_at', { ascending: true }),
      ])

      const itensData = itensRes.data
      const docsData = docsRes.data

      const docsByItem: Record<string, any[]> = {}
      if (docsData) {
        for (const doc of docsData as any[]) {
          if (!docsByItem[doc.checklist_item_id]) {
            docsByItem[doc.checklist_item_id] = []
          }
          docsByItem[doc.checklist_item_id].push({
            id: doc.id,
            oportunidade_id: doc.oportunidade_id,
            checklist_item_id: doc.checklist_item_id,
            arquivo_nome: doc.arquivo_nome,
            arquivo_caminho: doc.arquivo_caminho,
            arquivo_tamanho: doc.arquivo_tamanho,
            enviado_por: doc.enviado_por,
            enviado_por_nome: doc.enviado_usuario?.nome || null,
            enviado_em: doc.enviado_em,
            created_at: doc.created_at,
          })
        }
      }

      if (itensRes.error) {
        console.error('Erro ao buscar checklist:', itensRes.error)
      } else if (itensData) {
        checklistMap = (itensData as any[]).reduce(
          (acc, item) => {
            if (!acc[item.etapa_oportunidade_id]) {
              acc[item.etapa_oportunidade_id] = []
            }
            const itemDocs = docsByItem[item.id] || []
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
              arquivo_nome:
                itemDocs.length > 0
                  ? itemDocs[itemDocs.length - 1].arquivo_nome
                  : item.arquivo_nome,
              arquivo_url:
                itemDocs.length > 0
                  ? itemDocs[itemDocs.length - 1].arquivo_caminho
                  : item.arquivo_url,
              arquivo_tamanho:
                itemDocs.length > 0
                  ? itemDocs[itemDocs.length - 1].arquivo_tamanho
                  : item.arquivo_tamanho,
              documentos: itemDocs,
              concluido:
                item.tipo === 'Documento' ? itemDocs.length > 0 || item.concluido : item.concluido,
              concluido_por: item.concluido_por,
              concluido_por_nome: item.concluido_usuario?.nome || null,
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
      concluida_por_id: e.concluida_por_id,
      concluida_por_nome: e.concluido_por_usuario?.nome || null,
      prazo_dias: e.prazo_dias,
      is_etapa_ganho: Boolean(e.is_etapa_ganho),
      situacao: e.situacao,
      iniciada_em: e.iniciada_em,
      concluida_em: e.concluida_em,
      itens: checklistMap[e.id] || [],
      created_at: e.created_at,
      updated_at: e.updated_at,
    }))

    // Buscar interações ordenadas da mais recente para a mais antiga
    const { data: interacoesData, error: interacoesError } = await db
      .from('oportunidades_interacoes')
      .select(`
        id,
        oportunidade_id,
        tipo,
        data_contato,
        resumo,
        registrado_por,
        created_at,
        updated_at,
        usuario:profiles!registrado_por(id, nome)
      `)
      .eq('oportunidade_id', id)
      .order('data_contato', { ascending: false })

    if (interacoesError) {
      console.error('Erro ao buscar interações:', interacoesError)
    }

    const interacoes: OportunidadeInteracao[] = (interacoesData || []).map((i: any) => ({
      id: i.id,
      oportunidade_id: i.oportunidade_id,
      tipo: i.tipo,
      data_contato: i.data_contato,
      resumo: i.resumo,
      registrado_por: i.registrado_por,
      registrado_por_nome: i.usuario?.nome || 'Usuário',
      created_at: i.created_at,
      updated_at: i.updated_at,
    }))

    // Buscar timeline ordenada da mais recente para a mais antiga
    const { data: timelineData, error: timelineError } = await db
      .from('oportunidades_linha_tempo')
      .select(`
        id,
        oportunidade_id,
        tipo,
        titulo,
        descricao,
        usuario_id,
        metadados,
        created_at,
        usuario:profiles!usuario_id(id, nome)
      `)
      .eq('oportunidade_id', id)
      .order('created_at', { ascending: false })

    if (timelineError) {
      console.error('Erro ao buscar linha do tempo:', timelineError)
    }

    const timeline: OportunidadeTimelineItem[] = (timelineData || []).map((t: any) => ({
      id: t.id,
      oportunidade_id: t.oportunidade_id,
      tipo: t.tipo,
      titulo: t.titulo,
      descricao: t.descricao,
      usuario_id: t.usuario_id,
      usuario_nome: t.usuario?.nome || null,
      metadados: t.metadados,
      created_at: t.created_at,
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
      valor_fechado:
        opp.valor_fechado !== null && opp.valor_fechado !== undefined
          ? Number(opp.valor_fechado)
          : null,
      motivo_perda_id: opp.motivo_perda_id || null,
      motivo_perda_nome: (opp as any).motivo_perda?.nome || null,
      observacao_perda: opp.observacao_perda || null,
      data_prevista_fechamento: opp.data_prevista_fechamento,
      observacoes: opp.observacoes,
      situacao: opp.situacao,
      etapa_atual_id: opp.etapa_atual_id,
      etapa_atual_nome: opp.etapa_atual?.nome || null,
      numero_quiver: opp.numero_quiver || null,
      criado_por: opp.criado_por,
      criado_por_nome: opp.criador?.nome || null,
      created_at: opp.created_at,
      updated_at: opp.updated_at,
      etapas,
      interacoes,
      timeline,
    }

    return { data: detalhe, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao buscar detalhes da oportunidade.'
    return { data: null, error: msg }
  }
}

/**
 * Atualiza o número de proposta/apólice no Quiver da oportunidade
 */
export async function updateNumeroQuiver(
  oportunidadeId: string,
  numeroQuiver: string | null,
  usuarioId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db
      .from('oportunidades')
      .update({
        numero_quiver: numeroQuiver ? numeroQuiver.trim() : null,
      })
      .eq('id', oportunidadeId)

    if (error) {
      console.error('Erro ao salvar número Quiver:', error)
      return { success: false, error: error.message }
    }

    // Registrar na linha do tempo
    await registrarEventoLinhaTempo({
      oportunidade_id: oportunidadeId,
      tipo: 'quiver',
      titulo: numeroQuiver ? 'Nº Quiver atualizado' : 'Nº Quiver removido',
      descricao: numeroQuiver
        ? `Número da proposta/apólice cadastrado como: ${numeroQuiver.trim()}`
        : 'Número de identificação do Quiver foi desvinculado.',
      usuario_id: usuarioId,
      metadados: { numero_quiver: numeroQuiver },
    })

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao salvar número do Quiver.'
    return { success: false, error: msg }
  }
}

/**
 * Registra um evento na linha do tempo da oportunidade
 */
export async function registrarEventoLinhaTempo(input: {
  oportunidade_id: string
  tipo: TimelineTipo
  titulo: string
  descricao?: string | null
  usuario_id?: string | null
  metadados?: Record<string, unknown> | null
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.from('oportunidades_linha_tempo').insert({
      oportunidade_id: input.oportunidade_id,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao || null,
      usuario_id: input.usuario_id || null,
      metadados: input.metadados || null,
    })

    if (error) {
      console.error('Erro ao registrar na linha do tempo:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao registrar linha do tempo.'
    return { success: false, error: msg }
  }
}

/**
 * Adiciona uma interação com o cliente
 */
export async function createInteracao(input: {
  oportunidade_id: string
  tipo: InteracaoTipo
  data_contato: string
  resumo: string
  registrado_por: string
}): Promise<{ data: OportunidadeInteracao | null; error: string | null }> {
  try {
    const { data, error } = await db
      .from('oportunidades_interacoes')
      .insert({
        oportunidade_id: input.oportunidade_id,
        tipo: input.tipo,
        data_contato: input.data_contato,
        resumo: input.resumo.trim(),
        registrado_por: input.registrado_por,
      })
      .select(`
        id,
        oportunidade_id,
        tipo,
        data_contato,
        resumo,
        registrado_por,
        created_at,
        updated_at,
        usuario:profiles!registrado_por(id, nome)
      `)
      .single()

    if (error) {
      console.error('Erro ao registrar contato:', error)
      return { data: null, error: error.message }
    }

    // Gravar evento na linha do tempo automaticamente
    await registrarEventoLinhaTempo({
      oportunidade_id: input.oportunidade_id,
      tipo: 'interacao',
      titulo: `Contato registrado: ${input.tipo}`,
      descricao: input.resumo.trim(),
      usuario_id: input.registrado_por,
      metadados: { interacao_id: data.id, tipo: input.tipo },
    })

    const nova: OportunidadeInteracao = {
      id: data.id,
      oportunidade_id: data.oportunidade_id,
      tipo: data.tipo,
      data_contato: data.data_contato,
      resumo: data.resumo,
      registrado_por: data.registrado_por,
      registrado_por_nome: data.usuario?.nome || 'Usuário',
      created_at: data.created_at,
      updated_at: data.updated_at,
    }

    return { data: nova, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao adicionar contato.'
    return { data: null, error: msg }
  }
}

/**
 * Atualiza o valor e estado de conclusão de um item de checklist
 */
export async function updateChecklistItem(input: {
  item_id: string
  oportunidade_id: string
  etapa_nome?: string
  titulo: string
  valor?: string | null
  concluido: boolean
  usuario_id: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const now = new Date().toISOString()
    const { error } = await db
      .from('oportunidades_checklist_itens')
      .update({
        valor: input.valor !== undefined ? input.valor : null,
        concluido: input.concluido,
        concluido_por: input.concluido ? input.usuario_id : null,
        concluido_em: input.concluido ? now : null,
      })
      .eq('id', input.item_id)

    if (error) {
      console.error('Erro ao atualizar item do checklist:', error)
      return { success: false, error: error.message }
    }

    // Registrar na linha do tempo se foi marcado como concluído
    if (input.concluido) {
      await registrarEventoLinhaTempo({
        oportunidade_id: input.oportunidade_id,
        tipo: 'checklist_item',
        titulo: `Item de checklist cumprido: "${input.titulo}"`,
        descricao: input.valor ? `Valor preenchido: ${input.valor}` : 'Item confirmado.',
        usuario_id: input.usuario_id,
        metadados: { item_id: input.item_id },
      })
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao salvar item do checklist.'
    return { success: false, error: msg }
  }
}

/**
 * Upload de arquivo anexo no storage privado do Supabase
 */
export async function uploadChecklistAnexo(params: {
  oportunidade_id: string
  etapa_id: string
  item_id: string
  titulo: string
  file: File
  usuario_id: string
}): Promise<{
  data: { arquivo_nome: string; arquivo_url: string; arquivo_tamanho: number } | null
  error: string | null
}> {
  try {
    const ext = params.file.name.split('.').pop() || 'bin'
    const cleanFileName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${params.oportunidade_id}/${params.etapa_id}/${params.item_id}_${Date.now()}_${cleanFileName}`

    // Upload no bucket privado oportunidades-anexos
    const { error: uploadErr } = await supabase.storage
      .from('oportunidades-anexos')
      .upload(filePath, params.file, {
        upsert: true,
      })

    if (uploadErr) {
      console.error('Erro no upload para o storage:', uploadErr)
      // T2.03 — quando a política do bucket nega, o Storage responde com mensagem
      // técnica (RLS/policy). A constituição do projeto proíbe termo técnico na tela.
      const negado =
        /policy|permission|denied|unauthorized|forbidden|row-level/i.test(
          uploadErr.message || '',
        )
      return {
        data: null,
        error: negado
          ? 'Você não tem permissão para anexar arquivo nesta oportunidade.'
          : uploadErr.message,
      }
    }

    const now = new Date().toISOString()

    // 1. Inserir documento na nova tabela oportunidades_documentos (adiciona novo arquivo, nunca substitui)
    const { error: docInsertErr } = await db.from('oportunidades_documentos').insert({
      oportunidade_id: params.oportunidade_id,
      checklist_item_id: params.item_id,
      arquivo_nome: params.file.name,
      arquivo_caminho: filePath,
      arquivo_tamanho: params.file.size,
      enviado_por: params.usuario_id,
      enviado_em: now,
    })

    if (docInsertErr) {
      console.error('Erro ao inserir em oportunidades_documentos:', docInsertErr)
      return { data: null, error: docInsertErr.message }
    }

    // 2. Atualizar oportunidades_checklist_itens para compatibilidade e status de conclusão
    const { error: dbErr } = await db
      .from('oportunidades_checklist_itens')
      .update({
        arquivo_nome: params.file.name,
        arquivo_url: filePath,
        arquivo_tamanho: params.file.size,
        concluido: true,
        concluido_por: params.usuario_id,
        concluido_em: now,
      })
      .eq('id', params.item_id)

    if (dbErr) {
      console.error('Erro ao atualizar registro do anexo legado:', dbErr)
    }

    // Registrar na linha do tempo
    await registrarEventoLinhaTempo({
      oportunidade_id: params.oportunidade_id,
      tipo: 'documento',
      titulo: `Documento anexado: "${params.titulo}"`,
      descricao: `Arquivo "${params.file.name}" anexado com sucesso.`,
      usuario_id: params.usuario_id,
      metadados: {
        item_id: params.item_id,
        arquivo_nome: params.file.name,
        arquivo_caminho: filePath,
      },
    })

    return {
      data: {
        arquivo_nome: params.file.name,
        arquivo_url: filePath,
        arquivo_tamanho: params.file.size,
      },
      error: null,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao processar anexo.'
    return { data: null, error: msg }
  }
}

/**
 * Gera URL assinada temporária para download do anexo privado.
 *
 * T2.03 — a SPEC exige link "válido por minutos". Antes eram 3600s (1 hora), tempo
 * demais para um link que dá acesso a documento de cliente: quem copiasse a URL
 * continuava baixando por uma hora, mesmo sem permissão nenhuma. 300s (5 min) cobre
 * o uso real (abrir e baixar em seguida) sem virar link compartilhável.
 */
export const VALIDADE_LINK_DOWNLOAD_SEGUNDOS = 300

export async function getDownloadAnexoUrl(
  filePath: string,
  validadeSegundos: number = VALIDADE_LINK_DOWNLOAD_SEGUNDOS,
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase.storage
      .from('oportunidades-anexos')
      .createSignedUrl(filePath, validadeSegundos)

    if (error || !data) {
      console.error('Erro ao gerar URL assinada:', error)
      // T2.03 — a política do bucket agora exige ver a oportunidade. Quando ela nega,
      // o Supabase devolve erro técnico; a tela mostra linguagem de negócio.
      const negado =
        /policy|permission|denied|unauthorized|forbidden|row-level/i.test(
          error?.message || '',
        )
      return {
        url: null,
        error: negado
          ? 'Você não tem permissão para baixar este documento.'
          : error?.message || 'Erro ao gerar link de download.',
      }
    }

    return { url: data.signedUrl, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao obter anexo.'
    return { url: null, error: msg }
  }
}

/**
 * Conclui a etapa atual e avança para a próxima etapa via RPC segura no servidor
 */
export async function concluirEtapaOportunidade(params: {
  oportunidade_id: string
  etapa_atual_id: string
}): Promise<{
  success: boolean
  data?: {
    sucesso: boolean
    proxima_etapa_id: string | null
    era_etapa_ganho: boolean
    era_ultima_etapa: boolean
  } | null
  error: string | null
}> {
  try {
    const { data, error } = await db.rpc('concluir_etapa_oportunidade', {
      p_oportunidade_id: params.oportunidade_id,
      p_etapa_atual_id: params.etapa_atual_id,
    })

    if (error) {
      console.error('Erro na RPC concluir_etapa_oportunidade:', error)
      return { success: false, data: null, error: error.message }
    }

    return { success: true, data, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao concluir etapa.'
    return { success: false, data: null, error: msg }
  }
}

/**
 * Usuário assume a responsabilidade de uma etapa em fila_equipe
 */
export async function assumirEtapaOportunidade(params: {
  oportunidade_id: string
  etapa_id: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('assumir_etapa_oportunidade', {
      p_oportunidade_id: params.oportunidade_id,
      p_etapa_id: params.etapa_id,
    })

    if (error) {
      console.error('Erro na RPC assumir_etapa_oportunidade:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao assumir etapa.'
    return { success: false, error: msg }
  }
}

/**
 * Volta a etapa atual para a etapa anterior com motivo obrigatório
 */
export async function voltarEtapaOportunidade(params: {
  oportunidade_id: string
  etapa_atual_id: string
  motivo: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('voltar_etapa_oportunidade', {
      p_oportunidade_id: params.oportunidade_id,
      p_atual: params.etapa_atual_id,
      p_motivo: params.motivo.trim(),
    })

    if (error) {
      console.error('Erro na RPC voltar_etapa_oportunidade:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao voltar etapa.'
    return { success: false, error: msg }
  }
}

/**
 * Confirma o fechamento na etapa de ganho (seguradora, valor fechado, proposta)
 */
export async function confirmarGanhoOportunidade(params: {
  oportunidade_id: string
  seguradora_id: string | null
  valor_fechado: number
  numero_proposta: string
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('confirmar_ganho_oportunidade', {
      p_oportunidade_id: params.oportunidade_id,
      p_seguradora_id: params.seguradora_id,
      p_valor_fechado: params.valor_fechado,
      p_numero_proposta: params.numero_proposta,
    })

    if (error) {
      console.error('Erro na RPC confirmar_ganho_oportunidade:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao confirmar fechamento.'
    return { success: false, error: msg }
  }
}

/**
 * Marca oportunidade como perdida com motivo do catálogo e observação opcional
 */
export async function marcarOportunidadePerdida(params: {
  oportunidade_id: string
  motivo_id: string
  observacao?: string | null
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('marcar_oportunidade_perdida', {
      p_oportunidade_id: params.oportunidade_id,
      p_motivo_id: params.motivo_id,
      p_observacao: params.observacao?.trim() || null,
    })

    if (error) {
      console.error('Erro na RPC marcar_oportunidade_perdida:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao marcar como perdida.'
    return { success: false, error: msg }
  }
}

/**
 * Arquiva a oportunidade (apenas Administrador e Gestor)
 */
export async function arquivarOportunidade(params: {
  oportunidade_id: string
  motivo?: string | null
}): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await db.rpc('arquivar_oportunidade', {
      p_oportunidade_id: params.oportunidade_id,
      p_motivo: params.motivo?.trim() || null,
    })

    if (error) {
      console.error('Erro na RPC arquivar_oportunidade:', error)
      return { success: false, error: error.message }
    }

    return { success: true, error: null }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Falha ao arquivar oportunidade.'
    return { success: false, error: msg }
  }
}
