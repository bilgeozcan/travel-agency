import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BookingStepper } from './BookingStepper'

describe('BookingStepper', () => {
  it('renders standard 4 steps with "booked" status active', () => {
    render(<BookingStepper status="booked" />)

    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Started')).toBeInTheDocument()
    expect(screen.getByText('Finished')).toBeInTheDocument()

    const bookedStep = screen.getByTestId('booking-step-booked')
    const confirmedStep = screen.getByTestId('booking-step-confirmed')

    expect(bookedStep).toHaveClass('booking-stepper-item--completed')
    expect(confirmedStep).toHaveClass('booking-stepper-item--pending')
  })

  it('marks steps up to "started" as completed when status is "started"', () => {
    render(<BookingStepper status="started" />)

    const bookedStep = screen.getByTestId('booking-step-booked')
    const confirmedStep = screen.getByTestId('booking-step-confirmed')
    const startedStep = screen.getByTestId('booking-step-started')
    const finishedStep = screen.getByTestId('booking-step-finished')

    expect(bookedStep).toHaveClass('booking-stepper-item--completed')
    expect(confirmedStep).toHaveClass('booking-stepper-item--completed')
    expect(startedStep).toHaveClass('booking-stepper-item--completed')
    expect(finishedStep).toHaveClass('booking-stepper-item--pending')
  })

  it('renders all steps completed when status is "finished"', () => {
    render(<BookingStepper status="finished" />)

    const finishedStep = screen.getByTestId('booking-step-finished')
    expect(finishedStep).toHaveClass('booking-stepper-item--completed')
  })

  it('renders canceled step when status is "cancelled"', () => {
    render(<BookingStepper status="cancelled" />)

    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Canceled')).toBeInTheDocument()

    const canceledStep = screen.getByTestId('booking-step-canceled')
    expect(canceledStep).toHaveClass('booking-stepper-item--canceled')
  })

  it('dynamically builds step list for canceled status based on canceledAtStep prop', () => {
    const { rerender } = render(<BookingStepper status="cancelled" canceledAtStep="booked" />)
    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Canceled')).toBeInTheDocument()
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument()

    rerender(<BookingStepper status="cancelled" canceledAtStep="started" />)
    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Started')).toBeInTheDocument()
    expect(screen.getByText('Canceled')).toBeInTheDocument()
  })

  it('renders custom steps array if provided', () => {
    render(<BookingStepper status="step2" steps={['Step1', 'Step2', 'Step3']} />)

    expect(screen.getByText('Step1')).toBeInTheDocument()
    expect(screen.getByText('Step2')).toBeInTheDocument()
    expect(screen.getByText('Step3')).toBeInTheDocument()

    const step2 = screen.getByTestId('booking-step-step2')
    expect(step2).toHaveClass('booking-stepper-item--completed')
  })
})
