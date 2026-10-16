import React, { createContext, useContext, useState, ReactNode } from 'react'

interface OpportunityModalContextType {
  isOpen: boolean
  prefilledClient: string
  openModal: (defaultClientName?: string) => void
  closeModal: () => void
  setIsOpen: (open: boolean) => void
}

const OpportunityModalContext = createContext<OpportunityModalContextType | undefined>(undefined)

export const OpportunityModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [prefilledClient, setPrefilledClient] = useState('')

  const openModal = (defaultClientName?: string) => {
    if (defaultClientName) {
      setPrefilledClient(defaultClientName)
    } else {
      setPrefilledClient('')
    }
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setPrefilledClient('')
  }

  const handleSetIsOpen = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setPrefilledClient('')
    }
  }

  return (
    <OpportunityModalContext.Provider
      value={{
        isOpen,
        prefilledClient,
        openModal,
        closeModal,
        setIsOpen: handleSetIsOpen,
      }}
    >
      {children}
    </OpportunityModalContext.Provider>
  )
}

export const useOpportunityModal = () => {
  const context = useContext(OpportunityModalContext)
  if (!context) {
    throw new Error('useOpportunityModal must be used within an OpportunityModalProvider')
  }
  return context
}
