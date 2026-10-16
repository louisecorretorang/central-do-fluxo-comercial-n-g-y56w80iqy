import { supabase } from '@/lib/supabase/client'
import { FluxoModeloResumo, FluxoModeloDetalhe, FluxoEtapa, ChecklistItem } from '@/types/fluxos'

// Helper para queries sem tipagem estática legada
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * Busca todos os modelos de fluxo cadastrados, com contagem de etapas e dados de produto/seguradora
 */
export async function getFluxoModelos(): Promise<{
  data: FluxoModeloResumo[] | null
  error: Error | null
}> {
  try {
    const { data, error } = await db
      .from('fluxo_modelos')
      .select(`
        id,
        nome,
        produto_id,
        seguradora_id,
        is_generico,
        versao,
        situacao,
        descricao,
        created_at,
        updated_at,
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome),
        etapas:fluxo_etapas(id)
      `)
      .order('is_generico', { ascending: false })
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao buscar modelos de fluxo:', error)
      return { data: null, error: new Error(error.message) }
    }

    const modelos: FluxoModeloResumo[] = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      produto_id: row.produto_id,
      produto_nome: row.produto?.nome || null,
      produto_frente: row.produto?.frente || null,
      seguradora_id: row.seguradora_id,
      seguradora_nome: row.seguradora?.nome || null,
      is_generico: row.is_generico,
      versao: row.versao,
      situacao: row.situacao,
      descricao: row.descricao,
      total_etapas: Array.isArray(row.etapas) ? row.etapas.length : 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return { data: modelos, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar modelos de fluxo'
    return { data: null, error: new Error(message) }
  }
}

/**
 * Busca o detalhe completo de um modelo de fluxo específico:
 * dados do modelo + etapas em ordem + itens de checklist de cada etapa em ordem
 */
export async function getFluxoModeloById(id: string): Promise<{
  data: FluxoModeloDetalhe | null
  error: Error | null
}> {
  try {
    // 1. Buscar modelo
    const { data: modeloData, error: modeloError } = await db
      .from('fluxo_modelos')
      .select(`
        id,
        nome,
        produto_id,
        seguradora_id,
        is_generico,
        versao,
        situacao,
        descricao,
        created_at,
        updated_at,
        produto:produtos(id, nome, frente),
        seguradora:seguradoras_operadoras(id, nome)
      `)
      .eq('id', id)
      .single()

    if (modeloError) {
      console.error('Erro ao buscar detalhe do modelo:', modeloError)
      return { data: null, error: new Error(modeloError.message) }
    }

    if (!modeloData) {
      return { data: null, error: new Error('Modelo de fluxo não encontrado') }
    }

    // 2. Buscar etapas em ordem, com dados de equipe se houver
    const { data: etapasData, error: etapasError } = await db
      .from('fluxo_etapas')
      .select(`
        id,
        modelo_id,
        ordem,
        nome,
        descricao,
        tipo,
        responsavel_tipo,
        equipe_id,
        funcao,
        prazo_dias,
        is_etapa_ganho,
        created_at,
        updated_at,
        equipe:equipes(id, nome)
      `)
      .eq('modelo_id', id)
      .order('ordem', { ascending: true })

    if (etapasError) {
      console.error('Erro ao buscar etapas do modelo:', etapasError)
      return { data: null, error: new Error(etapasError.message) }
    }

    const etapas: FluxoEtapa[] = (etapasData || []).map((e: any) => ({
      id: e.id,
      modelo_id: e.modelo_id,
      ordem: e.ordem,
      nome: e.nome,
      descricao: e.descricao,
      tipo: e.tipo,
      responsavel_tipo: e.responsavel_tipo,
      equipe_id: e.equipe_id,
      equipe_nome: e.equipe?.nome || null,
      funcao: e.funcao,
      prazo_dias: e.prazo_dias,
      is_etapa_ganho: e.is_etapa_ganho,
      created_at: e.created_at,
      updated_at: e.updated_at,
      itens: [],
    }))

    // 3. Buscar todos os itens de checklist das etapas deste modelo
    const etapaIds = etapas.map((e) => e.id)
    if (etapaIds.length > 0) {
      const { data: itensData, error: itensError } = await db
        .from('fluxo_checklist_itens')
        .select('*')
        .in('etapa_id', etapaIds)
        .order('ordem', { ascending: true })

      if (itensError) {
        console.error('Erro ao buscar itens de checklist:', itensError)
        return { data: null, error: new Error(itensError.message) }
      }

      // Agrupar itens por etapa
      const itensPorEtapa = new Map<string, ChecklistItem[]>()
      for (const item of itensData || []) {
        const arr = itensPorEtapa.get(item.etapa_id) || []
        arr.push({
          id: item.id,
          etapa_id: item.etapa_id,
          ordem: item.ordem,
          titulo: item.titulo,
          tipo: item.tipo,
          formato: item.formato,
          opcoes: Array.isArray(item.opcoes) ? item.opcoes : null,
          obrigatorio: item.obrigatorio,
          created_at: item.created_at,
          updated_at: item.updated_at,
        })
        itensPorEtapa.set(item.etapa_id, arr)
      }

      for (const etapa of etapas) {
        etapa.itens = itensPorEtapa.get(etapa.id) || []
      }
    }

    const resultado: FluxoModeloDetalhe = {
      id: modeloData.id,
      nome: modeloData.nome,
      produto_id: modeloData.produto_id,
      produto_nome: modeloData.produto?.nome || null,
      produto_frente: modeloData.produto?.frente || null,
      seguradora_id: modeloData.seguradora_id,
      seguradora_nome: modeloData.seguradora?.nome || null,
      is_generico: modeloData.is_generico,
      versao: modeloData.versao,
      situacao: modeloData.situacao,
      descricao: modeloData.descricao,
      total_etapas: etapas.length,
      created_at: modeloData.created_at,
      updated_at: modeloData.updated_at,
      etapas,
    }

    return { data: resultado, error: null }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha ao buscar detalhe do modelo'
    return { data: null, error: new Error(message) }
  }
}
