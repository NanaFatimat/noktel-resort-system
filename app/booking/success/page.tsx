'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('booking_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    async function updateBooking() {
      if (!bookingId) {
        setStatus('error');
        return;
      }

      try {
        // Update the booking status to paid
        const bookingRef = doc(db, 'bookings', bookingId);
        await updateDoc(bookingRef, {
          paymentStatus: 'paid',
          status: 'confirmed'
        });
        setStatus('success');
      } catch (error) {
        console.error('Error updating booking:', error);
        setStatus('error');
      }
    }

    updateBooking();
  }, [bookingId]);

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
      {status === 'loading' && (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
          <h2 className="text-2xl font-serif font-bold text-slate-900">Confirming Payment...</h2>
          <p className="text-slate-500">Please wait while we verify your payment.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-slate-900">Payment Successful!</h2>
          <p className="text-slate-600">
            Your booking has been confirmed and paid for. We look forward to hosting you at Noktel Resort.
          </p>
          <Link href="/">
            <Button className="mt-4 w-full">Return to Home</Button>
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <span className="text-4xl">!</span>
          </div>
          <h2 className="text-2xl font-serif font-bold text-slate-900">Something went wrong</h2>
          <p className="text-slate-600">
            We couldn&apos;t verify your payment. Please contact support if you believe this is an error.
          </p>
          <Link href="/">
            <Button variant="outline" className="mt-4 w-full">Return to Home</Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense fallback={
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
            <h2 className="text-2xl font-serif font-bold text-slate-900">Loading...</h2>
          </div>
        </div>
      }>
        <BookingSuccessContent />
      </Suspense>
    </div>
  );
}
