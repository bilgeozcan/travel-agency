import React from 'react'
import './BookingStepper.css'
import { isCanceledStatus } from '@/features/bookings/utils/bookingStatusMapper'

export type BookingStatus = 'booked' | 'confirmed' | 'started' | 'finished' | 'cancelled' | 'canceled'

export interface StepItem {
  id: string
  label: string
}

export interface BookingStepperProps {
  /**
   * Current status of the booking flow.
   */
  status: BookingStatus | string
  /**
   * Optional step status prior to cancellation (e.g. 'booked', 'confirmed', 'started').
   * Used when status is 'cancelled' or 'canceled' to dynamically build steps up to cancellation.
   */
  canceledAtStep?: BookingStatus | string
  /**
   * Custom list of steps (optional).
   * Overrides default step generation if provided.
   */
  steps?: (StepItem | string)[]
  /**
   * Optional custom CSS root class.
   */
  className?: string
}

const STANDARD_STEPS = ['Booked', 'Confirmed', 'Started', 'Finished']

export const BookingStepper: React.FC<BookingStepperProps> = ({
  status: rawStatus,
  canceledAtStep,
  steps: customSteps,
  className = '',
}) => {
  const isCanceled = isCanceledStatus(rawStatus)
  const normalizedStatus = (rawStatus || '').toLowerCase()

  let stepList: string[] = []
  if (customSteps && customSteps.length > 0) {
    stepList = customSteps.map((s) => (typeof s === 'string' ? s : s.label))
  } else if (isCanceled) {
    const prevStatus = (canceledAtStep || 'confirmed').toLowerCase()
    if (prevStatus === 'booked') {
      stepList = ['Booked', 'Canceled']
    } else if (prevStatus === 'started') {
      stepList = ['Booked', 'Confirmed', 'Started', 'Canceled']
    } else {
      // Default: 'confirmed'
      stepList = ['Booked', 'Confirmed', 'Canceled']
    }
  } else {
    stepList = STANDARD_STEPS
  }

  // Calculate active index
  let activeIndex = -1
  if (!isCanceled) {
    activeIndex = stepList.findIndex((s) => s.toLowerCase() === normalizedStatus)
    if (activeIndex === -1 && normalizedStatus === 'finished') {
      activeIndex = stepList.length - 1
    } else if (activeIndex === -1) {
      activeIndex = 0
    }
  } else {
    // If canceled, all steps before Canceled are completed
    activeIndex = stepList.length - 2
  }

  const getFillPathD = (index: number) => {
    if (index === 0) {
      // First step: rounded left edge, right chevron arrow
      return 'M 4,1 L 149,1 L 169,16 L 149,31 L 4,31 A 3,3 0 0,1 1,28 L 1,4 A 3,3 0 0,1 4,1 Z'
    }
    // Subsequent steps: indented chevron left, right chevron arrow
    return 'M 1,1 L 149,1 L 169,16 L 149,31 L 1,31 L 21,16 Z'
  }

  const getStrokePathD = (index: number) => {
    if (index === 0) {
      // First step: full outline including left edge
      return 'M 4,1 L 149,1 L 169,16 L 149,31 L 4,31 A 3,3 0 0,1 1,28 L 1,4 A 3,3 0 0,1 4,1 Z'
    }
    // Subsequent steps: top edge, right chevron, bottom edge ONLY (attaches seamlessly without left double border)
    return 'M 1,1 L 149,1 L 169,16 L 149,31 L 1,31'
  }

  return (
    <nav className={`booking-stepper ${className}`.trim()} aria-label="Booking progress">
      {stepList.map((stepLabel, idx) => {
        const isCanceledStep = isCanceled && idx === stepList.length - 1
        const isCompleted = !isCanceledStep && idx <= activeIndex

        let statusClass = 'booking-stepper-item--pending'
        if (isCanceledStep) {
          statusClass = 'booking-stepper-item--canceled'
        } else if (isCompleted) {
          statusClass = 'booking-stepper-item--completed'
        }

        let positionClass = 'booking-stepper-item--middle'
        if (idx === 0) positionClass = 'booking-stepper-item--first'
        else if (idx === stepList.length - 1) positionClass = 'booking-stepper-item--last'

        return (
          <div
            key={`${stepLabel}-${idx}`}
            className={`booking-stepper-item ${statusClass} ${positionClass}`}
            data-testid={`booking-step-${stepLabel.toLowerCase()}`}
          >
            <svg
              className="booking-step-bg"
              viewBox="0 0 170 32"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className="booking-step-fill" d={getFillPathD(idx)} />
              <path
                className="booking-step-stroke"
                d={getStrokePathD(idx)}
                vectorEffect="non-scaling-stroke"
                fill="none"
              />
            </svg>

            <div className="booking-step-content">
              {isCompleted && (
                <svg
                  className="booking-step-icon booking-step-icon--check"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12L10 17L20 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {isCanceledStep && (
                <svg
                  className="booking-step-icon booking-step-icon--cancel"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              <span className="booking-step-label">{stepLabel}</span>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
