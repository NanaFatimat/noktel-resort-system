'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Calendar, Users, ChevronRight, ChevronLeft, CheckCircle2, X, CreditCard, Hotel } from 'lucide-react';
import { useRooms, Room } from '@/hooks/use-rooms';
import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface BookingWizardProps {
  onClose: () => void;
}

export function BookingWizard({ onClose }: BookingWizardProps) {
  const [step, setStep] = useState(1);
  const { rooms, loading: roomsLoading } = useRooms();
  
  // Form State
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [guestDetails, setGuestDetails] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'pay_at_hotel'>('pay_at_hotel');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Calculate total amount
  const calculateTotal = () => {
    if (!checkIn || !checkOut || !selectedRoom) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return nights > 0 ? nights * selectedRoom.price : selectedRoom.price;
  };

  const handleBook = async () => {
    setIsSubmitting(true);
    setError('');
    
    try {
      // If the user isn't logged in, generate a random guest ID instead of forcing Anonymous Auth
      // This prevents the auth/admin-restricted-operation error without requiring console configuration
      const customerId = auth.currentUser?.uid || `guest_${Math.random().toString(36).substring(2, 11)}`;

      const bookingData = {
        customerId: customerId,
        customerName: guestDetails.name,
        customerEmail: guestDetails.email,
        customerPhone: guestDetails.phone,
        roomId: selectedRoom!.id,
        roomName: selectedRoom!.name,
        checkIn: new Date(checkIn).toISOString(),
        checkOut: new Date(checkOut).toISOString(),
        guests: guests,
        totalAmount: calculateTotal(),
        status: 'pending',
        paymentMethod: paymentMethod,
        paymentStatus: 'unpaid',
        source: 'web',
        createdAt: new Date().toISOString()
      };

      let bookingId = '';
      try {
        const docRef = await addDoc(collection(db, 'bookings'), bookingData);
        bookingId = docRef.id;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'bookings');
        throw error;
      }

      if (paymentMethod === 'stripe') {
        // Call our API route to create a Stripe Checkout Session
        const response = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingData: { ...bookingData, roomId: selectedRoom!.id },
            successUrl: `${window.location.origin}/booking/success?booking_id=${bookingId}`,
            cancelUrl: `${window.location.origin}/booking/cancel`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to connect to payment server' }));
          throw new Error(errorData.error || 'Payment initialization failed');
        }

        const session = await response.json();

        if (session.error) {
          throw new Error(session.error);
        }

        // Redirect to Stripe Checkout URL directly
        if (session.url) {
          window.location.href = session.url;
        } else {
          throw new Error('Failed to get checkout URL from Stripe');
        }
      } else {
        // Pay at hotel, redirect to success page
        window.location.href = `/booking/success?booking_id=${bookingId}&payment_method=pay_at_hotel`;
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to complete booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-2xl font-serif font-bold text-slate-900">Book Your Stay</h2>
            <p className="text-sm text-slate-500">Step {step} of 4</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-slate-900">When would you like to stay?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Check-in Date</label>
                    <input 
                      type="date" 
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2.5 md:p-3 text-sm md:text-base border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Check-out Date</label>
                    <input 
                      type="date" 
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || new Date().toISOString().split('T')[0]}
                      className="w-full p-2.5 md:p-3 text-sm md:text-base border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Number of Guests</label>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                        className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                      >-</button>
                      <span className="text-lg font-medium w-6 text-center">{guests}</span>
                      <button 
                        onClick={() => setGuests(Math.min(10, guests + 1))}
                        className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                      >+</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-slate-900">Select a Room</h3>
                {roomsLoading ? (
                  <div className="py-10 text-center text-slate-500">Loading available rooms...</div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                    {rooms.filter(r => r.capacity >= guests).map(room => (
                      <div 
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedRoom?.id === room.id ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-amber-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-900 text-lg">{room.name}</h4>
                            <p className="text-sm text-slate-500 capitalize">{room.type} • Up to {room.capacity} guests</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-amber-600">₦{room.price.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">per night</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {rooms.filter(r => r.capacity >= guests).length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        No rooms available for {guests} guests. Please adjust your guest count.
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-slate-900">Guest Details</h3>
                
                <div className="bg-slate-50 p-4 rounded-lg mb-6 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-900">{selectedRoom?.name}</p>
                    <p className="text-sm text-slate-500">{checkIn} to {checkOut}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="font-bold text-amber-600 text-lg">₦{calculateTotal().toLocaleString()}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                    <input 
                      type="text" 
                      value={guestDetails.name}
                      onChange={(e) => setGuestDetails({...guestDetails, name: e.target.value})}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                    <input 
                      type="email" 
                      value={guestDetails.email}
                      onChange={(e) => setGuestDetails({...guestDetails, email: e.target.value})}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Phone Number</label>
                    <input 
                      type="tel" 
                      value={guestDetails.phone}
                      onChange={(e) => setGuestDetails({...guestDetails, phone: e.target.value})}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                      placeholder="+234 800 000 0000"
                    />
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h3 className="text-lg font-semibold text-slate-900">Payment Method</h3>
                <p className="text-slate-600 mb-4">Choose how you would like to pay for your stay.</p>
                
                <div className="space-y-4">
                  <div 
                    onClick={() => setPaymentMethod('stripe')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                      paymentMethod === 'stripe' ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-amber-200'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${paymentMethod === 'stripe' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Pay Now (Card)</h4>
                      <p className="text-sm text-slate-500">Pay securely now via Stripe. Faster check-in.</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => setPaymentMethod('pay_at_hotel')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                      paymentMethod === 'pay_at_hotel' ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-amber-200'
                    }`}
                  >
                    <div className={`p-3 rounded-full ${paymentMethod === 'pay_at_hotel' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Hotel className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Pay at Hotel</h4>
                      <p className="text-sm text-slate-500">Reserve now, pay when you arrive at the reception.</p>
                    </div>
                  </div>
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-slate-900">Booking Confirmed!</h3>
                <p className="text-slate-600 max-w-md">
                  Thank you, {guestDetails.name}. Your booking for {selectedRoom?.name} has been received. We look forward to hosting you at Noktel Resort.
                </p>
                <Button onClick={onClose} className="mt-8 px-8">Return to Home</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {step < 5 && (
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            ) : <div></div>}
            
            {step === 1 && (
              <Button 
                onClick={() => setStep(2)} 
                disabled={!checkIn || !checkOut}
              >
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            {step === 2 && (
              <Button 
                onClick={() => setStep(3)} 
                disabled={!selectedRoom}
              >
                Continue to Details <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {step === 3 && (
              <Button 
                onClick={() => setStep(4)} 
                disabled={!guestDetails.name || !guestDetails.email || !guestDetails.phone}
              >
                Continue to Payment <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {step === 4 && (
              <Button 
                onClick={handleBook} 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : (paymentMethod === 'stripe' ? 'Proceed to Payment' : 'Confirm Booking')}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
