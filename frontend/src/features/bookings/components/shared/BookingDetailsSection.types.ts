import React from 'react'

export interface BookingDetailRowItem {
  id?: string
  label: string
  value: React.ReactNode
  testId?: string
}

export interface BookingDetailsSectionProps {
  title?: string
  items: BookingDetailRowItem[]
  className?: string
  dataTestId?: string
}
