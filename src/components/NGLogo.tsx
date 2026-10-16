import React, { useState } from 'react'

interface NGLogoProps {
  className?: string
  variant?: 'color' | 'white'
  compact?: boolean
}

/**
 * Componente oficial de logotipo da Corretora N&G (Nunes & Grossi).
 * Tenta carregar os arquivos oficiais de logo do servidor www.corretorang.com.br
 * (extraídos diretamente do upload WordPress 2022/05) com fallback em vetor SVG estilizado da marca.
 */
export const NGLogo: React.FC<NGLogoProps> = ({
  className = '',
  variant = 'color',
  compact = false,
}) => {
  const [imgError, setImgError] = useState(false)

  // URLs reais do site da corretora identificadas no repositório /wp-content/uploads/2022/05/
  const remoteSrc =
    variant === 'white'
      ? 'https://www.corretorang.com.br/wp-content/uploads/2022/05/logo-corretora-360x175-branco-300x146.png'
      : 'https://www.corretorang.com.br/wp-content/uploads/2022/05/logo-corretora-360x175-colorido-300x146.png'

  if (!imgError) {
    return (
      <img
        src={remoteSrc}
        alt="Nunes & Grossi Corretora de Seguros"
        loading="lazy"
        onError={() => setImgError(true)}
        className={`object-contain transition-opacity duration-200 ${
          compact ? 'h-9 w-auto' : 'h-12 w-auto'
        } ${className}`}
      />
    )
  }

  // Fallback vetorial de alta definição com as cores da identidade N&G
  const isWhite = variant === 'white'
  const primaryColor = isWhite ? '#FFFFFF' : '#0C2D48'
  const tealColor = isWhite ? '#5EEAD4' : '#00A896'
  const subColor = isWhite ? 'rgba(255,255,255,0.75)' : '#64748B'

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Símbolo do monograma N&G */}
      <div
        className={`relative flex items-center justify-center rounded-xl font-bold font-sans shadow-sm ${
          compact ? 'w-9 h-9 text-base' : 'w-11 h-11 text-lg'
        }`}
        style={{
          background: isWhite
            ? 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(20,184,166,0.35) 100%)'
            : 'linear-gradient(135deg, #0C2D48 0%, #00A896 100%)',
          border: isWhite ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,168,150,0.2)',
          color: '#FFFFFF',
        }}
      >
        <span className="tracking-tight">N</span>
        <span style={{ color: tealColor }} className="text-xs mx-0.5">
          &amp;
        </span>
        <span className="tracking-tight">G</span>
      </div>

      {!compact && (
        <div className="flex flex-col leading-none">
          <div
            className="flex items-center gap-1 font-extrabold tracking-tight text-base"
            style={{ color: primaryColor }}
          >
            <span>NUNES</span>
            <span style={{ color: tealColor }}>&amp;</span>
            <span>GROSSI</span>
          </div>
          <span
            className="text-[10px] font-semibold tracking-wider uppercase mt-0.5"
            style={{ color: subColor }}
          >
            Corretora de Seguros
          </span>
        </div>
      )}
    </div>
  )
}

export default NGLogo
