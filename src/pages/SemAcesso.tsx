/* T2.04 — Tela de Sem Acesso - Central do Fluxo Comercial N&G */
import { Link } from 'react-router-dom'
import NGLogo from '@/components/NGLogo'
import { Button } from '@/components/ui/button'
import { ShieldAlert, Inbox } from 'lucide-react'

/**
 * T2.04 — resposta explícita para quem tenta abrir uma área que não é do perfil dele
 * (Usuários, Configurações → Fluxos, Configurações → Catálogo).
 *
 * Antes, o `AdminRoute` redirecionava para /minha-fila em silêncio: o colaborador era
 * jogado em outra tela sem explicação e não sabia se errou o endereço, se perdeu acesso
 * ou se o sistema falhou.
 *
 * Dois modos, porque a tela aparece em dois contextos diferentes:
 * - `fullPage` (rota /sem-acesso, acesso por link direto): página inteira, com a marca;
 * - inline (dentro do AdminRoute): o Layout já mostra o menu e a marca, então aqui vai só
 *   o painel — assim a pessoa continua podendo navegar para outra área.
 *
 * Conteúdo deliberado: nenhum botão "Tentar novamente" (não há nada a tentar, a restrição
 * é de perfil) e nenhum termo técnico (constituição do projeto).
 */

const ConteudoSemAcesso = () => (
  <>
    <div className="flex justify-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
        <ShieldAlert className="w-8 h-8" strokeWidth={1.75} />
      </div>
    </div>

    <div className="space-y-2">
      <h1 className="text-xl font-bold text-[#0C2D48]">Você não tem acesso a esta área</h1>
      <p className="text-sm text-slate-500 leading-relaxed">
        Esta parte do sistema é restrita aos administradores. Se você precisa usar esta tela para
        trabalhar, fale com um administrador para ajustar o seu acesso.
      </p>
    </div>

    <div className="flex justify-center">
      <Link to="/minha-fila">
        <Button className="rounded-xl bg-[#0C2D48] hover:bg-[#071c2e] text-white font-semibold text-xs h-11 px-5 btn-press gap-2">
          <Inbox className="w-4 h-4 text-teal-400" />
          <span>Ir para minha fila</span>
        </Button>
      </Link>
    </div>
  </>
)

interface SemAcessoProps {
  fullPage?: boolean
}

const SemAcesso = ({ fullPage = true }: SemAcessoProps) => {
  // Dentro do Layout: painel simples, sem repetir marca e sem ocupar a tela inteira.
  if (!fullPage) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <ConteudoSemAcesso />
        </div>
      </div>
    )
  }

  // Acesso por link direto: página inteira, no mesmo padrão do 404.
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <NGLogo variant="color" />
        </div>
        <ConteudoSemAcesso />
      </div>
    </div>
  )
}

export default SemAcesso
