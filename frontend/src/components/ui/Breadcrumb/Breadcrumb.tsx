import React from 'react'
import chevronRightIcon from '@/assets/icons/Chevron-right.svg'
import './Breadcrumb.css'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  if (!items || items.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className={`breadcrumb ${className}`.trim()} data-testid="breadcrumb">
      <ol className="breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <React.Fragment key={`${item.label}-${index}`}>
              <li className="breadcrumb__item">
                {isLast ? (
                  <span
                    className="breadcrumb__link breadcrumb__link--active"
                    aria-current="page"
                    data-testid="breadcrumb-active-item"
                  >
                    {item.label}
                  </span>
                ) : item.onClick ? (
                  <button
                    type="button"
                    className="breadcrumb__link breadcrumb__link--previous"
                    onClick={item.onClick}
                    data-testid={`breadcrumb-item-${index}`}
                  >
                    {item.label}
                  </button>
                ) : item.href ? (
                  <a
                    href={item.href}
                    className="breadcrumb__link breadcrumb__link--previous"
                    data-testid={`breadcrumb-item-${index}`}
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    className="breadcrumb__link breadcrumb__link--previous"
                    data-testid={`breadcrumb-item-${index}`}
                  >
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li className="breadcrumb__separator-item" aria-hidden="true">
                  <img
                    src={chevronRightIcon}
                    alt=""
                    width={16}
                    height={16}
                    className="breadcrumb__separator-icon"
                  />
                </li>
              )}
            </React.Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
