import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  fullWidth?: boolean
  isLoading?: boolean
  loadingText?: string
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = true,
  className = '',
  disabled,
  isLoading = false,
  loadingText,
  ...props
}) => {
  const buttonClass = [
    'btn',
    `btn-${variant}`,
    fullWidth ? 'w-full' : '',
    disabled || isLoading ? 'btn-disabled' : '',
    isLoading ? 'btn-loading' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClass}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="btn-loading-content">
          <span className="btn-spinner" aria-hidden="true" />
          {loadingText ? <span>{loadingText}</span> : null}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
