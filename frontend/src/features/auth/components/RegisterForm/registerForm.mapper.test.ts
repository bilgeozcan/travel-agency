import { describe, it, expect } from 'vitest'
import { toRegisterRequest } from './registerForm.mapper'
import type { RegisterFormData } from '../../../../utils/validation'

describe('registerForm.mapper - Boundary & Edge Case Tests', () => {
  it('maps standard valid RegisterFormData to RegisterRequest', () => {
    const formData: RegisterFormData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'ValidPassword123!',
      confirmPassword: 'ValidPassword123!',
    }

    const request = toRegisterRequest(formData)

    expect(request).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'ValidPassword123!',
    })
    expect((request as unknown as Record<string, string>).confirmPassword).toBeUndefined()
  })

  it('preserves leading and trailing whitespace if un-trimmed', () => {
    const formData: RegisterFormData = {
      firstName: '  John  ',
      lastName: '  Doe  ',
      email: '  JOHN.DOE@EXAMPLE.COM  ',
      password: ' Password123! ',
      confirmPassword: ' Password123! ',
    }

    const request = toRegisterRequest(formData)

    expect(request.firstName).toBe('  John  ')
    expect(request.lastName).toBe('  Doe  ')
    expect(request.email).toBe('  JOHN.DOE@EXAMPLE.COM  ')
    expect(request.password).toBe(' Password123! ')
  })

  it('handles empty string properties gracefully', () => {
    const formData: RegisterFormData = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    }

    const request = toRegisterRequest(formData)

    expect(request).toEqual({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    })
  })
})
