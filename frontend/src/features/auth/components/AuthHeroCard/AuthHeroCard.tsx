import React from 'react'
import { Logo } from '../../../../components/ui/Logo/Logo'
import heroBeachImg from '../../../../assets/images/hero-beach.jpg'
import './AuthHeroCard.css'

export interface AuthHeroCardProps {
  headline?: string
  imageSrc?: string
  logoVariant?: 'white' | 'dark'
  logoSize?: 'sm' | 'md' | 'lg'
  className?: string
}

export const AuthHeroCard: React.FC<AuthHeroCardProps> = ({
  headline = "Let's plan your next trip!",
  imageSrc = heroBeachImg,
  logoVariant = 'white',
  logoSize = 'lg',
  className = '',
}) => {
  return (
    <div
      className={`auth-hero-card ${className}`.trim()}
      style={{ '--hero-bg-img': `url(${imageSrc})` } as React.CSSProperties}
    >
      <Logo variant={logoVariant} size={logoSize} />
      <h2 className="auth-hero-headline">{headline}</h2>
    </div>
  )
}
