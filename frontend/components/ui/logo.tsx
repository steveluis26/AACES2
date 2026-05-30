import { cn } from '@/lib/utils'

interface AacesLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'white' | 'compact'
  showText?: boolean
}

export function AacesLogo({ 
  className, 
  size = 'md', 
  variant = 'default', 
  showText = true 
}: AacesLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16',
    xl: 'w-20 h-20'
  }

  const colorClasses = {
    default: 'text-primary-600',
    white: 'text-white',
    compact: 'text-primary-600'
  }

  return (
    <div className={cn('flex items-center', className)}>
      {/* Logo geométrico basado en el diseño descrito */}
      <div className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
        colorClasses[variant]
      )}>
        {/* Triángulo principal con estilo institucional */}
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Triángulo base en navy blue */}
          <path 
            d="M20 80 L50 20 L80 80 Z" 
            fill="currentColor"
            className="opacity-90"
          />
          
          {/* Diagonal en naranja (como el logo) */}
          <path 
            d="M50 20 L80 80" 
            stroke="#f97316"
            strokeWidth="8"
            strokeLinecap="round"
          />
          
          {/* Formas internas que sugieren letras */}
          <path 
            d="M35 60 Q50 45 65 60" 
            stroke="white"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Elemento adicional para dar sensación de "A" o "S" */}
          <circle 
            cx="50" 
            cy="50" 
            r="15" 
            stroke="white"
            strokeWidth="2"
            fill="none"
            className="opacity-60"
          />
        </svg>
      </div>
      
      {/* Texto AACES */}
      {showText && (
        <div className={cn(
          'ml-3',
          variant === 'white' ? 'text-white' : 'text-neutral-900'
        )}>
          <div className={cn(
            'font-bold tracking-tight',
            size === 'sm' && 'text-lg',
            size === 'md' && 'text-2xl',
            size === 'lg' && 'text-3xl',
            size === 'xl' && 'text-4xl'
          )}>
            AACES
          </div>
          {variant !== 'compact' && (
            <div className={cn(
              'text-sm font-medium opacity-70 mt-0.5',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base',
              size === 'xl' && 'text-lg'
            )}>
              Sistema de Gestión
            </div>
          )}
        </div>
      )}
    </div>
  )
}