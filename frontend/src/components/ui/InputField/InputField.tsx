import React from 'react'
import './InputField.css'

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  errorText?: string
  helperText?: string
  leftIconSrc?: string
  rightElement?: React.ReactNode
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  errorText,
  helperText,
  leftIconSrc,
  rightElement,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const errorMessage = error || errorText

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <div className={`input-wrapper ${leftIconSrc ? 'has-left-icon' : ''}`}>
        {leftIconSrc && (
          <img src={leftIconSrc} alt="" className="input-left-icon" aria-hidden="true" />
        )}
        <input
          id={inputId}
          className={`input ${errorMessage ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="input-right-element">
            {rightElement}
          </div>
        )}
      </div>
      {errorMessage ? (
        <span className="input-error-text" role="alert">
          {errorMessage}
        </span>
      ) : helperText ? (
        <span className="input-helper-text">{helperText}</span>
      ) : null}
    </div>
  )
}
