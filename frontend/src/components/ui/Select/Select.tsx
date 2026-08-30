import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import chevronDownIcon from '../../../assets/icons/Chevron-down.svg'
import chevronUpIcon from '../../../assets/icons/Chevron-up.svg'
import { usePortalPopover } from '@/hooks/usePortalPopover'
import { useClickOutside } from '@/hooks/useClickOutside'
import './Select.css'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  label?: string
  placeholder?: string
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  leftIconSrc?: string
  errorText?: string
  helperText?: string
  portal?: boolean
}

export const Select: React.FC<SelectProps> = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  leftIconSrc,
  errorText,
  helperText,
  id,
  className = '',
  disabled,
  onFocus,
  onBlur,
  portal = false,
  ...buttonProps
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  const isPlaceholder = !value && Boolean(placeholder)
  const selectedOptionLabel = useMemo(() => {
    const matched = options.find((option) => option.value === value)
    if (matched) return matched.label
    if (placeholder) return placeholder
    return options[0]?.label ?? ''
  }, [options, value, placeholder])

  const { triggerRef, portalRef, coords } = usePortalPopover(
    isOpen && portal,
    () => setIsOpen(false),
    4
  )

  useClickOutside(triggerRef, () => setIsOpen(false), isOpen && !portal)

  const renderPopover = () => {
    const popoverContent = (
      <div
        id={selectId ? `${selectId}-listbox` : undefined}
        role="listbox"
        className={`select-popover ${portal ? 'select-popover--portal' : ''}`}
        ref={portal ? portalRef : undefined}
        style={
          portal
            ? ({
                '--popover-top': `${coords.top}px`,
                '--popover-left': `${coords.left}px`,
                '--popover-width': `${coords.width}px`,
              } as React.CSSProperties)
            : undefined
        }
        data-testid={selectId ? `${selectId}-popover` : 'select-popover'}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={`select-popover-item ${option.value === value ? 'selected' : ''}`}
            onClick={() => {
              onChange?.(option.value)
              setIsOpen(false)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    )

    if (portal) {
      return createPortal(popoverContent, document.body)
    }

    return popoverContent
  }

  return (
    <div className={`select-group ${className}`}>
      {label && (
        <label htmlFor={selectId} className="select-label">
          {label}
        </label>
      )}
      <div ref={triggerRef} className={`select-wrapper ${leftIconSrc ? 'has-left-icon' : ''}`}>
        {leftIconSrc && (
          <img src={leftIconSrc} alt="" className="select-left-icon" aria-hidden="true" />
        )}
        <button
          type="button"
          id={selectId}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={selectId ? `${selectId}-listbox` : undefined}
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev)
            }
          }}
          onFocus={(e) => {
            onFocus?.(e)
          }}
          onBlur={(e) => {
            onBlur?.(e)
          }}
          disabled={disabled}
          className={`select-input select-trigger ${isPlaceholder ? 'select-placeholder' : ''} ${errorText ? 'select-error' : ''}`}
          {...buttonProps}
        >
          {selectedOptionLabel}
        </button>
        <img
          src={isOpen ? chevronUpIcon : chevronDownIcon}
          alt=""
          className="select-chevron-icon"
          aria-hidden="true"
        />
        {isOpen && renderPopover()}
      </div>
      {errorText ? (
        <span className="select-error-text">{errorText}</span>
      ) : helperText ? (
        <span className="select-helper-text">{helperText}</span>
      ) : null}
    </div>
  )
}
