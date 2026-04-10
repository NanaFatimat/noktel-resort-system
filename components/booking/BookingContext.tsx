'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BookingWizard } from '@/components/booking/BookingWizard';

interface BookingContextType {
  isBookingModalOpen: boolean;
  openBookingModal: () => void;
  closeBookingModal: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const openBookingModal = () => setIsBookingModalOpen(true);
  const closeBookingModal = () => setIsBookingModalOpen(false);

  return (
    <BookingContext.Provider value={{ isBookingModalOpen, openBookingModal, closeBookingModal }}>
      {children}
      {isBookingModalOpen && <BookingWizard onClose={closeBookingModal} />}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
