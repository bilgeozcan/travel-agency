import React from 'react'
import type { PasswordChecks } from '../../../../utils/validation'

export interface PasswordRequirementsListProps {
  password: string
  checks: PasswordChecks
  isSubmitted: boolean
}

export const PasswordRequirementsList: React.FC<PasswordRequirementsListProps> = ({
  password,
  checks,
  isSubmitted,
}) => {
  const getReqClass = (isValid: boolean) => {
    if (!password) return ''
    if (isValid) return 'valid'
    if (isSubmitted) return 'invalid'
    return ''
  }

  return (
    <ul className="password-requirements-list">
      <li className={`req-item ${getReqClass(checks.hasUpper)}`}>
        <span className="req-bullet"></span>
        At least one uppercase letter required
      </li>
      <li className={`req-item ${getReqClass(checks.hasLower)}`}>
        <span className="req-bullet"></span>
        At least one lowercase letter required
      </li>
      <li className={`req-item ${getReqClass(checks.hasNumber)}`}>
        <span className="req-bullet"></span>
        At least one number required
      </li>
      <li className={`req-item ${getReqClass(checks.hasSpecial)}`}>
        <span className="req-bullet"></span>
        At least one special character required
      </li>
      <li className={`req-item ${getReqClass(checks.validLength)}`}>
        <span className="req-bullet"></span>
        Password must be 8-64 characters long
      </li>
    </ul>
  )
}
