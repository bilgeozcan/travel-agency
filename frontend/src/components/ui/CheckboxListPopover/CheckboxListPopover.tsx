import React from 'react'
import './CheckboxListPopover.css'

export interface CheckboxOptionItem<T extends string = string> {
  value: T
  label: string
}

export interface CheckboxListPopoverProps<T extends string = string> {
  isOpen: boolean
  options: CheckboxOptionItem<T>[]
  selectedValues: T[]
  onToggleOption: (value: T) => void
  onClose?: () => void
  className?: string
  testId?: string
}

export function CheckboxListPopover<T extends string = string>({
  isOpen,
  options,
  selectedValues,
  onToggleOption,
  onClose: _onClose,
  className = '',
  testId = 'checkbox-list-popover',
}: CheckboxListPopoverProps<T>): React.ReactElement | null {
  if (!isOpen) return null

  return (
    <div
      className={`checkbox-list-popover ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
      data-testid={testId}
    >
      {options.map((opt) => {
        const isChecked = selectedValues.includes(opt.value)
        return (
          <div
            key={opt.value}
            className={`checkbox-list-item ${isChecked ? 'selected' : ''}`}
            onClick={() => onToggleOption(opt.value)}
            data-testid={`checkbox-option-${opt.value.toLowerCase()}`}
          >
            <span className={`checkbox-custom ${isChecked ? 'checked' : ''}`}>
              {isChecked && '✓'}
            </span>
            <span className="checkbox-item-label">{opt.label}</span>
          </div>
        )
      })}
    </div>
  )
}
