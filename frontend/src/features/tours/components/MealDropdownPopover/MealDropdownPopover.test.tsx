import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MealDropdownPopover } from './MealDropdownPopover'

describe('MealDropdownPopover Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <MealDropdownPopover
        isOpen={false}
        selectedMealPlans={[]}
        onToggleMealPlan={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByTestId('meal-dropdown-popover')).not.toBeInTheDocument()
  })

  it('renders all meal plan options when isOpen is true', () => {
    render(
      <MealDropdownPopover
        isOpen={true}
        selectedMealPlans={['BB']}
        onToggleMealPlan={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('meal-dropdown-popover')).toBeInTheDocument()
    expect(screen.getByText('Breakfast (BB)')).toBeInTheDocument()
    expect(screen.getByText('Half-board (HB)')).toBeInTheDocument()
    expect(screen.getByText('Full-board (FB)')).toBeInTheDocument()
    expect(screen.getByText('All inclusive (AI)')).toBeInTheDocument()
  })

  it('triggers onToggleMealPlan when an option is clicked', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()

    render(
      <MealDropdownPopover
        isOpen={true}
        selectedMealPlans={[]}
        onToggleMealPlan={handleToggle}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByText('Half-board (HB)'))
    expect(handleToggle).toHaveBeenCalledWith('HB')
  })
})
