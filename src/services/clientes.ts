import { supabase } from '@/lib/supabase/client'
import {
  Cliente,
  ClienteFormData,
  ClienteContato,
  ClienteContatoFormData,
  ClienteSituacao,
} from '@/types/clientes'
import { onlyDigits, parseDateBRToISO } from '@/lib/clientes-utils'

// Helper seguro para tabelas novas até que types.ts seja re-gerado
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export interface ClientesFilter {
  search?: string
  situacao?: ClienteSituacao | 'todos'
  tipo?: 'PJ' | 'PF' | 'todos'
}

/**
 * Busca clientes com dados do responsável e contatos
 */
export const getClientes = async (
  filters?: ClientesFilter,
): Promise<{ data: Cliente[] | null; error: any }> => {
  try {
    let query = db
      .from('clientes')
      .select(`
        *,
        responsavel_comercial:profiles!responsavel_comercial_id(id, nome, email),
        contatos:clientes_contatos(*)
      `)
      .order('created_at', { ascending: false })

    if (filters?.situacao && filters.situacao !== 'todos') {
      query = query.eq('situacao', filters.situacao)
    }

    if (filters?.tipo && filters.tipo !== 'todos') {
      query = query.eq('tipo', filters.tipo)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar clientes:', error)
      return { data: null, error }
    }

    // Filtragem local por texto (cobre nome, razão social, documento) se fornecido
    let result = (data as unknown as Cliente[]) || []
    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase()
      const termDigits = onlyDigits(term)

      result = result.filter((c) => {
        const nomeMatch = (c.nome_completo || '').toLowerCase().includes(term)
        const razaoMatch = (c.razao_social || '').toLowerCase().includes(term)
        const fantasiaMatch = (c.nome_fantasia || '').toLowerCase().includes(term)
        const docMatch = termDigits
          ? (c.cnpj && c.cnpj.includes(termDigits)) || (c.cpf && c.cpf.includes(termDigits))
          : false
        const cidadeMatch = (c.cidade || '').toLowerCase().includes(term)
        const respMatch = (c.responsavel_comercial?.nome || '').toLowerCase().includes(term)

        return nomeMatch || razaoMatch || fantasiaMatch || docMatch || cidadeMatch || respMatch
      })
    }

    return { data: result, error: null }
  } catch (err) {
    console.error('Falha de rede ao buscar clientes:', err)
    return { data: null, error: err }
  }
}

/**
 * Busca um cliente específico por ID com seus contatos
 */
export const getClienteById = async (id: string): Promise<{ data: Cliente | null; error: any }> => {
  try {
    const { data, error } = await db
      .from('clientes')
      .select(`
        *,
        responsavel_comercial:profiles!responsavel_comercial_id(id, nome, email),
        origem_lead:origens_lead!origem_id(id, nome),
        contatos:clientes_contatos(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Erro ao buscar cliente por ID:', error)
      return { data: null, error }
    }

    // Ordenar contatos para que o principal venha primeiro
    if (data && Array.isArray(data.contatos)) {
      data.contatos.sort((a: any, b: any) => {
        if (a.principal === b.principal) return 0
        return a.principal ? -1 : 1
      })
    }

    return { data: data as unknown as Cliente, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Verifica se já existe cliente com o documento fornecido (CPF ou CNPJ)
 * Retorna o cliente existente caso encontre
 */
export const findClienteByDocumento = async (
  tipo: 'PJ' | 'PF',
  documento: string,
  excludeId?: string,
): Promise<{ exists: boolean; cliente: Cliente | null }> => {
  try {
    const digits = onlyDigits(documento)
    if (!digits) return { exists: false, cliente: null }

    let query = db
      .from('clientes')
      .select('id, tipo, razao_social, nome_completo, cnpj, cpf, situacao')

    if (tipo === 'PJ') {
      query = query.eq('cnpj', digits)
    } else {
      query = query.eq('cpf', digits)
    }

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query.limit(1)

    if (error || !data || data.length === 0) {
      return { exists: false, cliente: null }
    }

    return { exists: true, cliente: data[0] as unknown as Cliente }
  } catch {
    return { exists: false, cliente: null }
  }
}

/**
 * Criação de cliente
 */
export const createCliente = async (
  formData: ClienteFormData,
): Promise<{ success: boolean; data?: Cliente; error?: string; existingCliente?: Cliente }> => {
  try {
    const docDigits = formData.tipo === 'PJ' ? onlyDigits(formData.cnpj) : onlyDigits(formData.cpf)

    if (docDigits) {
      const check = await findClienteByDocumento(formData.tipo, docDigits)
      if (check.exists && check.cliente) {
        return {
          success: false,
          error: 'Este cliente já está cadastrado',
          existingCliente: check.cliente,
        }
      }
    }

    const insertPayload: any = {
      tipo: formData.tipo,
      cidade: formData.cidade?.trim() || null,
      uf: formData.uf?.trim() ? formData.uf.trim().toUpperCase() : null,
      origem: formData.origem?.trim() || null,
      origem_id: formData.origem_id || null,
      indicado_por_tipo: formData.indicado_por_tipo || null,
      indicado_por_nome: formData.indicado_por_nome?.trim() || null,
      responsavel_comercial_id: formData.responsavel_comercial_id || null,
      observacoes: formData.observacoes?.trim() || null,
      situacao: 'ativo',
    }

    if (formData.tipo === 'PJ') {
      insertPayload.cnpj = docDigits || null
      insertPayload.razao_social = formData.razao_social?.trim() || null
      insertPayload.nome_fantasia = formData.nome_fantasia?.trim() || null
      insertPayload.segmento = formData.segmento?.trim() || null
      insertPayload.porte = formData.porte || null
      insertPayload.numero_vidas =
        formData.numero_vidas !== '' && formData.numero_vidas !== undefined
          ? Number(formData.numero_vidas)
          : null
    } else {
      insertPayload.cpf = docDigits || null
      insertPayload.nome_completo = formData.nome_completo?.trim() || null
      insertPayload.data_de_nascimento = parseDateBRToISO(formData.data_de_nascimento) || null
    }

    const { data, error } = await db.from('clientes').insert(insertPayload).select().single()

    if (error) {
      if (error.code === '23505') {
        const check = await findClienteByDocumento(formData.tipo, docDigits)
        return {
          success: false,
          error: 'Este cliente já está cadastrado',
          existingCliente: check.cliente || undefined,
        }
      }
      return { success: false, error: 'Não foi possível cadastrar o cliente. Verifique os dados.' }
    }

    return { success: true, data: data as unknown as Cliente }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha na comunicação com o servidor.' }
  }
}

/**
 * Atualização de cliente
 */
export const updateCliente = async (
  id: string,
  formData: ClienteFormData,
): Promise<{ success: boolean; data?: Cliente; error?: string; existingCliente?: Cliente }> => {
  try {
    const docDigits = formData.tipo === 'PJ' ? onlyDigits(formData.cnpj) : onlyDigits(formData.cpf)

    if (docDigits) {
      const check = await findClienteByDocumento(formData.tipo, docDigits, id)
      if (check.exists && check.cliente) {
        return {
          success: false,
          error: 'Este cliente já está cadastrado',
          existingCliente: check.cliente,
        }
      }
    }

    const updatePayload: any = {
      tipo: formData.tipo,
      cidade: formData.cidade?.trim() || null,
      uf: formData.uf?.trim() ? formData.uf.trim().toUpperCase() : null,
      origem: formData.origem?.trim() || null,
      origem_id: formData.origem_id || null,
      indicado_por_tipo: formData.indicado_por_tipo || null,
      indicado_por_nome: formData.indicado_por_nome?.trim() || null,
      responsavel_comercial_id: formData.responsavel_comercial_id || null,
      observacoes: formData.observacoes?.trim() || null,
    }

    if (formData.tipo === 'PJ') {
      updatePayload.cnpj = docDigits || null
      updatePayload.razao_social = formData.razao_social?.trim() || null
      updatePayload.nome_fantasia = formData.nome_fantasia?.trim() || null
      updatePayload.segmento = formData.segmento?.trim() || null
      updatePayload.porte = formData.porte || null
      updatePayload.numero_vidas =
        formData.numero_vidas !== '' && formData.numero_vidas !== undefined
          ? Number(formData.numero_vidas)
          : null
      // Limpa dados PF
      updatePayload.cpf = null
      updatePayload.nome_completo = null
      updatePayload.data_de_nascimento = null
    } else {
      updatePayload.cpf = docDigits || null
      updatePayload.nome_completo = formData.nome_completo?.trim() || null
      updatePayload.data_de_nascimento = parseDateBRToISO(formData.data_de_nascimento) || null
      // Limpa dados PJ
      updatePayload.cnpj = null
      updatePayload.razao_social = null
      updatePayload.nome_fantasia = null
      updatePayload.segmento = null
      updatePayload.porte = null
      updatePayload.numero_vidas = null
    }

    const { data, error } = await db
      .from('clientes')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        const check = await findClienteByDocumento(formData.tipo, docDigits, id)
        return {
          success: false,
          error: 'Este cliente já está cadastrado',
          existingCliente: check.cliente || undefined,
        }
      }
      return { success: false, error: 'Não foi possível atualizar o cliente.' }
    }

    return { success: true, data: data as unknown as Cliente }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha na comunicação com o servidor.' }
  }
}

/**
 * Alternar situação de arquivamento (ativo <-> arquivado)
 */
export const toggleClienteSituacao = async (
  id: string,
  novaSituacao: ClienteSituacao,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db.from('clientes').update({ situacao: novaSituacao }).eq('id', id)

    if (error) {
      return { success: false, error: 'Não foi possível alterar a situação do cliente.' }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de rede.' }
  }
}

/* =========================================================================
   CONTATOS DO CLIENTE
   ========================================================================= */

export const getContatosByCliente = async (
  clienteId: string,
): Promise<{ data: ClienteContato[] | null; error: any }> => {
  try {
    const { data, error } = await db
      .from('clientes_contatos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('principal', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) return { data: null, error }
    return { data: data as unknown as ClienteContato[], error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export const createContato = async (
  clienteId: string,
  formData: ClienteContatoFormData,
): Promise<{ success: boolean; data?: ClienteContato; error?: string }> => {
  try {
    const insertPayload: any = {
      cliente_id: clienteId,
      nome: formData.nome.trim(),
      cargo_area: formData.cargo_area,
      telefone: formData.telefone?.trim() || null,
      email: formData.email?.trim() || null,
      principal: Boolean(formData.principal),
    }

    const { data, error } = await db
      .from('clientes_contatos')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return { success: false, error: 'Não foi possível adicionar o contato.' }
    }

    return { success: true, data: data as unknown as ClienteContato }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de comunicação.' }
  }
}

export const updateContato = async (
  contatoId: string,
  formData: ClienteContatoFormData,
): Promise<{ success: boolean; data?: ClienteContato; error?: string }> => {
  try {
    const updatePayload: any = {
      nome: formData.nome.trim(),
      cargo_area: formData.cargo_area,
      telefone: formData.telefone?.trim() || null,
      email: formData.email?.trim() || null,
      principal: Boolean(formData.principal),
    }

    const { data, error } = await db
      .from('clientes_contatos')
      .update(updatePayload)
      .eq('id', contatoId)
      .select()
      .single()

    if (error) {
      return { success: false, error: 'Não foi possível salvar as alterações do contato.' }
    }

    return { success: true, data: data as unknown as ClienteContato }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de comunicação.' }
  }
}

export const setContatoPrincipal = async (
  clienteId: string,
  contatoId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // O trigger no banco já desmarca outros ao setar principal = true
    const { error } = await db
      .from('clientes_contatos')
      .update({ principal: true })
      .eq('id', contatoId)
      .eq('cliente_id', clienteId)

    if (error) {
      return { success: false, error: 'Não foi possível definir como contato principal.' }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de rede.' }
  }
}

export const deleteContato = async (
  contatoId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await db.from('clientes_contatos').delete().eq('id', contatoId)

    if (error) {
      return { success: false, error: 'Não foi possível remover o contato.' }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha de rede.' }
  }
}

/**
 * Busca lista simplificada de usuários comerciais ativos para select de responsável comercial
 */
export const getResponsaveisComerciais = async (): Promise<{
  data: { id: string; nome: string; email: string }[] | null
  error: any
}> => {
  try {
    const { data, error } = await db
      .from('profiles')
      .select('id, nome, email')
      .eq('situacao', 'ativo')
      .order('nome', { ascending: true })

    if (error) return { data: null, error }
    return { data: data || [], error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}
