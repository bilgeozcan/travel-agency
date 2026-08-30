import type { RegisterRequest } from '../../../../api/types/auth.types'
import type { RegisterFormData } from '../../../../utils/validation'

export const toRegisterRequest = ({
  firstName,
  lastName,
  email,
  password,
}: RegisterFormData): RegisterRequest => ({
  firstName,
  lastName,
  email,
  password,
})