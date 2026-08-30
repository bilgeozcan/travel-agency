import React, { useState } from 'react'
import eyeIconAsset from '@/assets/icons/eye.svg'
import eyeOffIconAsset from '@/assets/icons/eye-off.svg'
import { InputField } from '../InputField/InputField'
import type { InputFieldProps } from '../InputField/InputField'

export interface PasswordInputProps extends Omit<InputFieldProps, 'type' | 'rightElement'> {
  showToggle?: boolean
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  showToggle = true,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false)

  const toggleVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  const eyeIcon = (
    <button
      type="button"
      onClick={toggleVisibility}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="eye-toggle-btn"
    >
      <img
        src={showPassword ? eyeOffIconAsset : eyeIconAsset}
        alt=""
        aria-hidden="true"
        width="24"
        height="24"
      />
    </button>
  )

  return (
    <InputField
      {...props}
      type={showPassword ? 'text' : 'password'}
      rightElement={showToggle ? eyeIcon : undefined}
    />
  )
}
