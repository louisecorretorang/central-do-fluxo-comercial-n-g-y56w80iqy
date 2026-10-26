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
  redirectTo?: string
}

interface ResendInvitePayload {
  action: 'resend_invite'
  userId?: string
  email: string
  redirectTo?: string
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

type Payload = InviteUserPayload | ResendInvitePayload | UpdateUserPayload | ToggleStatusPayload

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
    // 2. Client com service_role para executar operações com poderes elevados
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

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
      // Sempre usar URL pública de produção caso o chamador ou o ambiente não informem
      const defaultAppUrl = 'https://central-do-fluxo-comercial-ng-bf9f0.goskip.app'
      const rawEnvUrl = Deno.env.get('SITE_URL')?.trim()
      const rawBodyUrl = body.redirectTo?.trim()

      let resolvedBaseUrl = defaultAppUrl
      if (rawEnvUrl && !rawEnvUrl.includes('localhost')) {
        resolvedBaseUrl = rawEnvUrl
      } else if (rawBodyUrl && !rawBodyUrl.includes('localhost')) {
        resolvedBaseUrl = rawBodyUrl
      }

      resolvedBaseUrl = resolvedBaseUrl.replace(/\/+$/, '')

      const finalCallbackUrl = resolvedBaseUrl.includes('/auth/callback')
        ? resolvedBaseUrl
        : `${resolvedBaseUrl}/auth/callback`

      console.log(`[invite] target email: ${email}, finalCallbackUrl: ${finalCallbackUrl}`)

      const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            nome,
            name: nome,
            telefone,
            perfil,
            funcao,
            redirect_to: finalCallbackUrl,
            redirectTo: finalCallbackUrl,
          },
          redirectTo: finalCallbackUrl,
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

    // ACTION: RESEND INVITE
    if (body.action === 'resend_invite') {
      const email = body.email?.trim().toLowerCase()
      if (!email) {
        return new Response(JSON.stringify({ error: 'Informe o e-mail do usuário.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Buscar perfil existente (por e-mail ou nome para tolerar 'colaborador seguros')
      let userProfile: {
        id: string
        nome: string
        telefone: string | null
        perfil: string
        funcao: string
        situacao: string
        email: string
      } | null = null

      const { data: byEmail, error: profErr } = await adminClient
        .from('profiles')
        .select('id, nome, telefone, perfil, funcao, situacao, email')
        .eq('email', email)
        .maybeSingle()

      if (byEmail) {
        userProfile = byEmail
      } else {
        // Tenta buscar por nome se o email fornecido for um alias ou nickname
        const { data: byName } = await adminClient
          .from('profiles')
          .select('id, nome, telefone, perfil, funcao, situacao, email')
          .ilike('nome', email)
          .maybeSingle()
        if (byName) {
          userProfile = byName
        }
      }

      if (profErr || !userProfile) {
        return new Response(JSON.stringify({ error: 'Usuário não encontrado na base de dados.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const targetEmail = userProfile.email

      if (userProfile.situacao === 'inativo') {
        return new Response(
          JSON.stringify({
            error: 'Este usuário está inativo. Reative o usuário antes de reenviar o convite.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const defaultAppUrl = 'https://central-do-fluxo-comercial-ng-bf9f0.goskip.app'
      const rawEnvUrl = Deno.env.get('SITE_URL')?.trim()
      const rawBodyUrl = body.redirectTo?.trim()

      // Ordem de preferência:
      // 1. Deno.env.get('SITE_URL') (se válido e sem localhost)
      // 2. body.redirectTo (se válido e sem localhost)
      // 3. defaultAppUrl (hardcoded https://central-do-fluxo-comercial-ng-bf9f0.goskip.app)
      let resolvedBaseUrl = defaultAppUrl
      if (rawEnvUrl && !rawEnvUrl.includes('localhost')) {
        resolvedBaseUrl = rawEnvUrl
      } else if (rawBodyUrl && !rawBodyUrl.includes('localhost')) {
        resolvedBaseUrl = rawBodyUrl
      }

      // Garante que não haja trailing slash
      resolvedBaseUrl = resolvedBaseUrl.replace(/\/+$/, '')

      // Monta /auth/callback preservando query params se já vierem
      const finalCallbackUrl = resolvedBaseUrl.includes('/auth/callback')
        ? resolvedBaseUrl
        : `${resolvedBaseUrl}/auth/callback`

      const recoveryRedirect = `${finalCallbackUrl}${
        finalCallbackUrl.includes('?') ? '&' : '?'
      }type=recovery`

      // Se for modo apenas de verificação (dry-run para testes sem disparar e-mail nem consumir rate limits)
      // Também gera um recovery link via admin.generateLink para inspeção exata de parâmetros sem envio por email
      // @ts-expect-error dryRun opcional
      if (body.dryRun === true) {
        const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email: targetEmail,
          options: {
            redirectTo: recoveryRedirect,
          },
        })

        return new Response(
          JSON.stringify({
            success: true,
            dryRun: true,
            targetEmail,
            resolvedRedirectUrl: recoveryRedirect,
            finalCallbackUrl,
            siteUrlEnv: rawEnvUrl || null,
            generatedActionLink: linkData?.properties?.action_link || null,
            linkError: linkErr ? linkErr.message : null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      console.log(
        `[resend_invite] target email: ${targetEmail}, finalCallbackUrl: ${finalCallbackUrl}`,
      )

      // 1. Tenta reenviar convite diretamente via inviteUserByEmail
      // Passa redirectTo tanto na raiz de options quanto em data para máxima compatibilidade
      const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(targetEmail, {
        data: {
          nome: userProfile.nome,
          name: userProfile.nome,
          telefone: userProfile.telefone,
          perfil: userProfile.perfil,
          funcao: userProfile.funcao,
          redirect_to: finalCallbackUrl,
          redirectTo: finalCallbackUrl,
        },
        redirectTo: finalCallbackUrl,
      })

      // Se o usuário já tiver sido registrado/confirmado, inviteUserByEmail pode dar erro:
      // "A user with this email address has already been registered"
      // Nesses casos, usamos resetPasswordForEmail
      if (inviteErr) {
        console.warn(
          'inviteUserByEmail retornou ao reenviar, usando resetPasswordForEmail:',
          inviteErr.message,
        )

        console.log(
          `[resend_invite] calling resetPasswordForEmail with redirectTo: ${recoveryRedirect}`,
        )

        const { error: resetErr } = await adminClient.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: recoveryRedirect,
        })

        if (resetErr) {
          return new Response(
            JSON.stringify({
              error: `Não foi possível reenviar o link: ${resetErr.message || inviteErr.message}`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Link de ativação e definição de senha enviado para ${targetEmail}.`,
            resolvedRedirectUrl: recoveryRedirect,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Convite reenviado com sucesso para ${targetEmail}.`,
          resolvedRedirectUrl: finalCallbackUrl,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ACTION: UPDATE
    if (body.action === 'update') {
      const { userId, nome, telefone, perfil, funcao, equipeIds } = body

      if (!userId) {
        return new Response(JSON.stringify({ error: 'ID do usuário não fornecido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Se estiver alterando a própria conta, validar que não pode se rebaixar
      if (callerUser.id === userId) {
        if (perfil && perfil !== 'Administrador') {
          return new Response(
            JSON.stringify({ error: 'Você não pode alterar seu próprio perfil de acesso.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
      }

      // T2.01 — CA-1-08: 'situacao' NÃO pode mudar por aqui. A alteração de situação
      // só acontece pela ação toggle_status, que também bane/desbane em auth.users.
      // Antes, update com situacao = 'inativo' deixava o usuário sem sessão revogada.

      const updateData: Record<string, unknown> = {}
      if (nome !== undefined) updateData.nome = nome.trim()
      if (telefone !== undefined) updateData.telefone = telefone.trim() || null
      if (perfil !== undefined) updateData.perfil = perfil
      if (funcao !== undefined) updateData.funcao = funcao

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
        // T2.01: metadataUpdate não inclui 'situacao' — mudança de situação só via
        // toggle_status, que grava o ban em auth.users (ver adiante nesta função).

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

      // T2.01 — CA-1-08: bloqueio do inativo garantido no servidor.
      // O trigger trg_profiles_situacao_login_ban (migração
      // 20261020110000_t201_bloqueio_inativo.sql) já faz isso no banco para qualquer
      // caminho; aqui repetimos via API de admin para não depender só do trigger
      // (defesa em profundidade) e para o efeito ser imediato na edge function.
      if (situacao === 'inativo') {
        const { error: banErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // ~100 anos; o trigger remove ao reativar
        })
        if (banErr) {
          console.error('Erro ao banir usuário inativo:', banErr)
        }
        // Revoga os refresh tokens: a sessão aberta não renova.
        const { error: logoutErr } = await adminClient.auth.admin.signOut(userId)
        if (logoutErr) {
          console.error('Erro ao revogar sessões do usuário inativo:', logoutErr)
        }
      } else {
        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        })
        if (unbanErr) {
          console.error('Erro ao remover ban do usuário reativado:', unbanErr)
        }
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
