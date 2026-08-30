import React from 'react'
import './PageLoader.css'

interface PageLoaderProps {
  label?: string
  inline?: boolean
}

export const PageLoader: React.FC<PageLoaderProps> = ({ label = 'Loading...', inline = false }) => {
  return (
    <div className={inline ? "page-loader-inline" : "page-loader-overlay"} role="status" aria-live="polite" aria-label={label}>
      <div className="page-loader-spinner">
        <div className="page-loader-ring" aria-hidden="true" />
        <span className="page-loader-label">{label}</span>
      </div>
    </div>
  )
}
