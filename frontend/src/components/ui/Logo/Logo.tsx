import React from 'react'
import './Logo.css'

export interface LogoProps {
  variant?: 'white' | 'dark' | 'blue'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onClick?: () => void
}

const SuitcaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="10 4 28 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M19 36V18H16V36M25.5 36V18H22.5V36M32 36V18H29V36M34.06 12C36.22 12 38 13.76 38 16V38C38 40.26 36.22 42 34.06 42C34.06 43.16 33.12 44 32 44C31 44 30 43.16 30 42H18C18 43.16 17 44 16 44C14.88 44 13.94 43.16 13.94 42C11.78 42 10 40.26 10 38V16C10 13.76 11.78 12 13.94 12H18V6C18 4.84 18.92 4 20 4H28C29.08 4 30 4.84 30 6V12M21 7V12H27V7M34.06 38V16H13.94V38"
      fill="currentColor"
    />
  </svg>
)

export const Logo: React.FC<LogoProps> = ({
  variant = 'white',
  size = 'lg',
  className = '',
  onClick,
}) => {
  const containerClass = [
    'logo-container',
    `logo-${variant}`,
    `logo-${size}`,
    onClick ? 'cursor-pointer' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClass} onClick={onClick}>
      <SuitcaseIcon className="logo-icon" />
      <span>Travel Agency</span>
    </div>
  )
}
