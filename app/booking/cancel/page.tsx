'use client';

import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BookingCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
            <XCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-slate-900">Payment Cancelled</h2>
          <p className="text-slate-600">
            Your payment process was cancelled. Your booking has not been completed.
          </p>
          <div className="flex flex-col gap-3 w-full mt-4">
            <Link href="/">
              <Button className="w-full">Try Booking Again</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
