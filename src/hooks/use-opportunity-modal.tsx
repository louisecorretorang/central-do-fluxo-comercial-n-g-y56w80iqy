import React, { createContext, useContext, useState, ReactNode } from 'react'

interface OpportunityModalContextType {
  isOpen: boolean
  openModal: () => void
  closeModal: () => void
  setIsOpen: (open: boolean) => void
}

const OpportunityModalContext = createContext<OpportunityModalContextType | undefined>(undefined)

export const OpportunityModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)

  const openModal = () => setIsOpen(true)
  const closeModal = () => setIsOpen(false)

  return (
    <OpportunityModalContext.Provider value={{ isOpen, openModal, closeModal, setIsOpen }}>
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
