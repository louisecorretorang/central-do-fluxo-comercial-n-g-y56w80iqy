import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface InviteUserPayload {
  action: 'invite'
  email: string
  nome: string
  telefone?: string
  perfil: 'Administrador' | 'Gestor' | 'Colaborador'
  funcao: 'Comercial' | 'Pós-venda' | 'Gestão'
  equipeIds: string[]
}

interface UpdateUserPayload {
  action: 'update'
  userId: string
  nome?: string
  telefone?: string
  perfil?: 'Administrador' | 'Gestor' | 'Colaborador'
  funcao?: 'Comercial' | 'Pós-venda' | 'Gestão'
  situacao?: 'ativo' | 'inativo'
  equipeIds?: string[]
}

interface ToggleStatusPayload {
  action: 'toggle_status'
  userId: string
  situacao: 'ativo' | 'inativo'
}

type Payload = InviteUserPayload | UpdateUserPayload | ToggleStatusPayload

Deno.serve(async (req: Request) => {
  // Trata preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Acesso não autorizado. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // 1. Verificar caller usando anon client com token JWT do chamador
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const {
      data: { user: callerUser },
      error: authErr,
    } = await callerClient.auth.getUser()

    if (authErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida ou expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. Client com service_role para executar operações com poderes elevados
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 3. Checar se o chamador é Administrador ativo
    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, perfil, situacao')
      .eq('id', callerUser.id)
      .single()

    if (profileErr || !callerProfile) {
      return new Response(JSON.stringify({ error: 'Perfil do usuário não encontrado.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (callerProfile.perfil !== 'Administrador' || callerProfile.situacao !== 'ativo') {
      return new Response(
        JSON.stringify({ error: 'Apenas administradores podem gerenciar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = (await req.json()) as Payload

    // ACTION: INVITE
    if (body.action === 'invite') {
      const email = body.email?.trim().toLowerCase()
      const nome = body.nome?.trim()
      const telefone = body.telefone?.trim() || null
      const perfil = body.perfil || 'Colaborador'
      const funcao = body.funcao || 'Comercial'
      const equipeIds = Array.isArray(body.equipeIds) ? body.equipeIds : []

      if (!email) {
        return new Response(JSON.stringify({ error: 'Informe o e-mail do usuário.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!nome) {
        return new Response(JSON.stringify({ error: 'Informe o nome do usuário.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Checar se já existe no profiles ou auth.users
      const { data: existingUser } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle()

      if (existingUser) {
        return new Response(
          JSON.stringify({ error: 'Já existe um usuário cadastrado com este e-mail.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Envia convite por e-mail através da API de Admin do Supabase
      const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000'
      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            nome,
            name: nome,
            telefone,
            perfil,
            funcao,
          },
          redirectTo: siteUrl,
        },
      )

      if (inviteErr) {
        // Trata erro de limite ou e-mail já existente no auth
        return new Response(
          JSON.stringify({ error: `Não foi possível enviar o convite: ${inviteErr.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const newUserId = inviteData.user.id

      // Upsert no profile para garantir integridade caso o trigger não tenha completado
      const { error: profileUpsertErr } = await adminClient.from('profiles').upsert(
        {
          id: newUserId,
          nome,
          email,
          telefone,
          perfil,
          funcao,
          situacao: 'ativo',
        },
        { onConflict: 'id' },
      )

      if (profileUpsertErr) {
        console.error('Erro ao registrar perfil:', profileUpsertErr)
      }

      // Vincular equipes
      if (equipeIds.length > 0) {
        // Remove vínculos antigos se houver
        await adminClient.from('profile_equipes').delete().eq('profile_id', newUserId)

        const insertEquipes = equipeIds.map((eqId) => ({
          profile_id: newUserId,
          equipe_id: eqId,
        }))
        const { error: linkErr } = await adminClient.from('profile_equipes').insert(insertEquipes)
        if (linkErr) {
          console.error('Erro ao vincular equipes:', linkErr)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Convite enviado com sucesso.',
          userId: newUserId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ACTION: UPDATE
    if (body.action === 'update') {
      const { userId, nome, telefone, perfil, funcao, situacao, equipeIds } = body

      if (!userId) {
        return new Response(JSON.stringify({ error: 'ID do usuário não fornecido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Se estiver alterando a própria conta, validar que não pode se rebaixar ou desativar
      if (callerUser.id === userId) {
        if (perfil && perfil !== 'Administrador') {
          return new Response(
            JSON.stringify({ error: 'Você não pode alterar seu próprio perfil de acesso.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        if (situacao && situacao === 'inativo') {
          return new Response(
            JSON.stringify({ error: 'Você não pode desativar sua própria conta.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      const updateData: Record<string, unknown> = {}
      if (nome !== undefined) updateData.nome = nome.trim()
      if (telefone !== undefined) updateData.telefone = telefone.trim() || null
      if (perfil !== undefined) updateData.perfil = perfil
      if (funcao !== undefined) updateData.funcao = funcao
      if (situacao !== undefined) updateData.situacao = situacao

      if (Object.keys(updateData).length > 0) {
        const { error: updateErr } = await adminClient
          .from('profiles')
          .update(updateData)
          .eq('id', userId)

        if (updateErr) {
          return new Response(JSON.stringify({ error: 'Não foi possível atualizar o usuário.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Também atualiza metadata em auth.users para manter coerência
        const metadataUpdate: Record<string, unknown> = {}
        if (nome !== undefined) {
          metadataUpdate.nome = nome.trim()
          metadataUpdate.name = nome.trim()
        }
        if (telefone !== undefined) metadataUpdate.telefone = telefone.trim() || null
        if (perfil !== undefined) metadataUpdate.perfil = perfil
        if (funcao !== undefined) metadataUpdate.funcao = funcao

        if (Object.keys(metadataUpdate).length > 0) {
          await adminClient.auth.admin.updateUserById(userId, {
            user_metadata: metadataUpdate,
          })
        }
      }

      // Atualizar equipes se enviadas
      if (Array.isArray(equipeIds)) {
        await adminClient.from('profile_equipes').delete().eq('profile_id', userId)
        if (equipeIds.length > 0) {
          const insertEquipes = equipeIds.map((eqId) => ({
            profile_id: userId,
            equipe_id: eqId,
          }))
          await adminClient.from('profile_equipes').insert(insertEquipes)
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Usuário atualizado com sucesso.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ACTION: TOGGLE STATUS (desativar / reativar)
    if (body.action === 'toggle_status') {
      const { userId, situacao } = body

      if (!userId || !situacao) {
        return new Response(JSON.stringify({ error: 'Dados incompletos.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (callerUser.id === userId && situacao === 'inativo') {
        return new Response(
          JSON.stringify({ error: 'Você não pode desativar seu próprio usuário.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const { error: toggleErr } = await adminClient
        .from('profiles')
        .update({ situacao })
        .eq('id', userId)

      if (toggleErr) {
        return new Response(
          JSON.stringify({ error: 'Não foi possível alterar a situação do usuário.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const message =
        situacao === 'ativo' ? 'Usuário reativado com sucesso.' : 'Usuário desativado com sucesso.'

      return new Response(JSON.stringify({ success: true, message }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    console.error('Unhandled error:', err)
    const message = err instanceof Error ? err.message : 'Erro interno no servidor'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
