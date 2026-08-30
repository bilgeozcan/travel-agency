import React from 'react'
import './TabBar.css'

export interface TabBarProps {
  tabs: string[]
  activeTab: string
  onChange: (tab: string) => void
  className?: string
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`tab-bar-container ${className}`} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-bar-item ${isActive ? 'tab-bar-item--active' : ''}`}
            onClick={() => onChange(tab)}
          >
            {tab}
          </button>
        )
      })}
    </div>
  )
}
