import type { GuestInfo } from '../../types/bookings'

export interface GuestDetailsFormProps {
  guestDetails: GuestInfo[]
  errors: Record<string, string>
  onGuestInputChange: (index: number, field: keyof GuestInfo, value: string) => void
  isPrimaryGuestReadOnly?: boolean
}
