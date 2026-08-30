import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from './RegisterForm'
import { authService } from '../../../../api/services/auth.service'

describe('RegisterForm - Acceptance Criteria Spec Suite', () => {
  const mockNavigateToLogin = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(authService, 'register').mockResolvedValue({
      success: true,
      message: 'Account created successfully',
    })
  })

  // ==========================================
  // Section 1: Form Layout & Fields Rendering
  // ==========================================
  it('AC-1: renders all 5 required input fields and the submit button', () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    expect(screen.getByLabelText(/First name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: /Create an account/i })
    ).toBeInTheDocument()
  })

  // ==========================================
  // Section 2: Password Eye Icon Show/Hide Toggle
  // ==========================================
  it('AC-2: toggles password visibility when eye icon is clicked', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    const passwordInput = screen.getByLabelText(/^Password/i) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtns = screen.getAllByRole('button', { name: /Show password/i })
    await userEvent.click(toggleBtns[0])
    expect(passwordInput.type).toBe('text')

    await userEvent.click(screen.getAllByRole('button', { name: /Hide password/i })[0])
    expect(passwordInput.type).toBe('password')
  })

  // ==========================================
  // Section 3: Login Link Navigation
  // ==========================================
  it('AC-3: redirects to Login page when Login link is clicked', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    const loginLink = screen.getByRole('link', { name: /Login/i })
    await userEvent.click(loginLink)

    expect(mockNavigateToLogin).toHaveBeenCalledTimes(1)
  })

  // ==========================================
  // Section 4: Disabled Button State (Empty Fields)
  // ==========================================
  it('AC-4: button is disabled when any required field is empty', () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    const submitBtn = screen.getByRole('button', { name: /Create an account/i })
    expect(submitBtn).toBeDisabled()

    // Fill only 4 of 5 fields
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Secret123!' } })

    expect(submitBtn).toBeDisabled()
  })

  // ==========================================
  // Section 5: Field Validations & Exact Error Messages
  // ==========================================
  it('AC-5a: shows exact error for invalid First Name (containing numbers/spaces)', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John 123' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'ValidPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'ValidPass123!' } })

    const submitBtn = screen.getByRole('button', { name: /Create an account/i })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'First name must be up to 50 characters. Only Latin letters hyphens and apostrophes are allowed'
    )
  })

  it('AC-5b: shows exact error for invalid Last Name', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe 123' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'ValidPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'ValidPass123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Last name must be up to 50 characters. Only Latin letters hyphens and apostrophes are allowed'
    )
  })

  it('AC-5c: shows exact error for invalid Email format', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'invalid-email-format' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'ValidPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'ValidPass123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Invalid email address. Please ensure it follows the format: username@domain.com'
    )
  })

  it('AC-5d: shows the duplicate email error returned by registration', async () => {
    vi.mocked(authService.register).mockRejectedValueOnce(
      new Error('This email is already registered. Please sign in')
    )

    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'registered@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'ValidPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'ValidPass123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This email is already registered. Please sign in')
  })

  it('AC-5e: shows exact error for Password missing uppercase', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'lowercase123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'lowercase123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('At least one uppercase letter required')
  })

  it('AC-5f: shows exact error for Password missing lowercase', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'UPPERCASE123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'UPPERCASE123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('At least one lowercase letter required')
  })

  it('AC-5g: shows exact error for Password missing number', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'NoNumberHere!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'NoNumberHere!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('At least one number required')
  })

  it('AC-5h: shows exact error for Password missing special character', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'NoSpecialChar123' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'NoSpecialChar123' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('At least one special character required')
  })

  it('AC-5i: shows exact error for Password shorter than 8 characters', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Short1!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'Short1!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Password must be 8-64 characters long')
  })

  it('AC-5j: shows error for Breached Password', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Password123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'Password123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'This password is too common or breached. Please choose a stronger password'
    )
  })

  it('AC-5k: shows exact error for Password mismatch', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'ValidPass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'DifferentPass123!' } })

    fireEvent.click(screen.getByRole('button', { name: /Create an account/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Confirm password must match new password')
  })

  // ==========================================
  // Section 6: Success Toast Handling & Navigation
  // ==========================================
  it('AC-6: displays success toast message and redirects on valid registration', async () => {
    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john.doe@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'MyUniquePass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'MyUniquePass123!' } })

    const submitBtn = screen.getByRole('button', { name: /Create an account/i })
    expect(submitBtn).not.toBeDisabled()

    fireEvent.click(submitBtn)

    expect(await screen.findByText(/Congratulations/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Your account has been created successfully. Please sign in with your details/i)
    ).toBeInTheDocument()
    expect(authService.register).toHaveBeenCalledWith({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'MyUniquePass123!',
    })
  })

  it('AC-7: prevents duplicate registration submissions while the request is pending', () => {
    vi.spyOn(authService, 'register').mockReturnValue(new Promise(() => undefined))

    render(<RegisterForm onNavigateToLogin={mockNavigateToLogin} />)

    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'John' } })
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'john.doe@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'MyUniquePass123!' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'MyUniquePass123!' } })

    const submitButton = screen.getByRole('button', { name: /Create an account/i })
    fireEvent.click(submitButton)

    expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled()
    fireEvent.click(submitButton)
    expect(authService.register).toHaveBeenCalledTimes(1)
  })
})
