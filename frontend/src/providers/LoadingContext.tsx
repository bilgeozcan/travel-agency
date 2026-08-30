import React, { createContext, useCallback, useContext, useState } from 'react'

interface LoadingContextValue {
  isLoading: boolean
  startLoading: (key: string) => void
  stopLoading: (key: string) => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export const LoadingProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set())

  const stopLoading = useCallback((key: string) => {
    setLoadingKeys((prev) => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const startLoading = useCallback((key: string) => {
    setLoadingKeys((prev) => new Set(prev).add(key))
  }, [])

  return (
    <LoadingContext.Provider
      value={{
        isLoading: loadingKeys.size > 0,
        startLoading,
        stopLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  )
}

export const useLoading = (): LoadingContextValue => {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
