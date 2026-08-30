// Application Route Paths

export const PATHS = {
  LOGIN: '/login',
  REGISTER: '/register',
  RESET_PASSWORD: '/reset-password',
  RESET_PASSWORD_VERIFY: '/reset-password/verify',
  RESET_PASSWORD_NEW: '/reset-password/new',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  MANAGE_TOURS: '/manage-tours',
  TOUR_DETAILS: '/tours/:tourId',
  MY_TOURS: '/my-tours',
} as const

export type AppPath = typeof PATHS[keyof typeof PATHS]

export const tourDetailsPath = (tourId: string): string => `/tours/${tourId}`
