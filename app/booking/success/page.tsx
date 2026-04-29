'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, UserPlus, KeyRound, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import Link from 'next/link';

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
import { FileText, Download } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import PDF components to avoid SSR issues
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

// For the PDF component itself, we can import it normally if it doesn't use browser APIs
// but let's keep it safe
import { InvoicePDF } from '@/components/booking/InvoicePDF';

// Fallback for dynamic imports if needed, but let's try standard dynamic first
// Actually, Next.js dynamic might not work perfectly with @react-pdf/renderer in all versions
// Let's use a simpler approach: import them normally but only render when mounted

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get('booking_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [bookingData, setBookingData] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  
  // Account Form State
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [password, setPassword] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [linkingError, setLinkingError] = useState('');

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !bookingData) return;
    
    setLinkingLoading(true);
    setLinkingError('');
    
    try {
      let userCred;
      if (isLoginMode) {
        userCred = await signInWithEmailAndPassword(auth, bookingData.customerEmail, password);
      } else {
        userCred = await createUserWithEmailAndPassword(auth, bookingData.customerEmail, password);
        // Create user document
        await setDoc(doc(db, 'users', userCred.user.uid), {
          role: 'customer',
          name: bookingData.customerName,
          email: bookingData.customerEmail,
          createdAt: new Date().toISOString()
        });
      }
      
      // Update booking to link it to the user
      await updateDoc(doc(db, 'bookings', bookingId as string), {
        customerId: userCred.user.uid
      });
      
      // Refresh booking data state so UI reflects the real link
      setBookingData((prev: any) => ({ ...prev, customerId: userCred.user.uid }));
      setIsLinked(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setLinkingError('This email is already registered. Please sign in instead.');
        setIsLoginMode(true);
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLinkingError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/weak-password') {
        setLinkingError('Password is too weak. Must be at least 6 characters.');
      } else {
        setLinkingError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLinkingLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function updateAndFetchBooking() {
      if (!bookingId || !isAuthReady) {
        return;
      }

      try {
        const bookingRef = doc(db, 'bookings', bookingId);
        let bookingSnap;
        try {
          bookingSnap = await getDoc(bookingRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `bookings/${bookingId}`);
          return;
        }
        
        if (!bookingSnap.exists()) {
          setStatus('error');
          return;
        }

        const data = bookingSnap.data();
        
        // If it's a Stripe booking, we assume success if they reached this page
        // (In a real app, we'd verify with a webhook, but this is the success redirect)
        if (data.paymentMethod === 'stripe' && data.paymentStatus !== 'paid') {
          try {
            await updateDoc(bookingRef, {
              paymentStatus: 'paid',
              status: 'confirmed'
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
          }
          // Refresh data after update
          const updatedSnap = await getDoc(bookingRef);
          setBookingData({ id: updatedSnap.id, ...updatedSnap.data() });
        } else if (data.paymentMethod === 'pay_at_hotel') {
          // For pay at hotel, we just confirm the reservation status if not already
          if (data.status !== 'confirmed') {
            try {
              await updateDoc(bookingRef, {
                status: 'confirmed'
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
            }
            const updatedSnap = await getDoc(bookingRef);
            setBookingData({ id: updatedSnap.id, ...updatedSnap.data() });
          } else {
            setBookingData({ id: bookingSnap.id, ...data });
          }
        } else {
          setBookingData({ id: bookingSnap.id, ...data });
        }
        
        setStatus('success');
      } catch (error) {
        console.error('Error updating booking:', error);
        setStatus('error');
      }
    }

    updateAndFetchBooking();
  }, [bookingId, isAuthReady]);

  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6">
      {status === 'loading' && (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
          <h2 className="text-2xl font-serif font-bold text-slate-900">
            {searchParams.get('payment_method') === 'pay_at_hotel' ? 'Securing Reservation...' : 'Confirming Payment...'}
          </h2>
          <p className="text-slate-500">
            {searchParams.get('payment_method') === 'pay_at_hotel' 
              ? 'Please wait while we finalize your booking.' 
              : 'Please wait while we verify your payment.'}
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-slate-900">
            {bookingData?.paymentMethod === 'pay_at_hotel' ? 'Reservation Confirmed!' : 'Payment Successful!'}
          </h2>
          <p className="text-slate-600">
            {bookingData?.paymentMethod === 'pay_at_hotel' 
              ? 'Your reservation is secured. Please pay at the front desk upon arrival.'
              : 'Your booking has been confirmed and paid for. We look forward to hosting you at Noktel Resort.'}
          </p>
          
          {/* Pro Level Receipt Section */}
          <div className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Booking ID:</span>
              <span className="font-mono font-medium text-slate-900">#{bookingId?.slice(-8).toUpperCase()}</span>
            </div>
            
            {isMounted && bookingData && (
              <div className="pt-2">
                <PDFDownloadLink
                  document={<InvoicePDF booking={bookingData} />}
                  fileName={bookingData.paymentMethod === 'pay_at_hotel' 
                    ? `Noktel-Voucher-${bookingId?.slice(-8).toUpperCase()}.pdf`
                    : `Noktel-Invoice-${bookingId?.slice(-8).toUpperCase()}.pdf`}
                >
                  {({ loading: pdfLoading }) => (
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 border-amber-200 hover:bg-amber-50 text-amber-700"
                      disabled={pdfLoading}
                    >
                      {pdfLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                      {pdfLoading 
                        ? 'Preparing Document...' 
                        : (bookingData.paymentMethod === 'pay_at_hotel' ? 'Download Reservation Voucher' : 'Download PDF Invoice')}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            )}
          </div>

          {/* Account Tracking Prompt */}
          {bookingData?.customerId?.startsWith('guest_') && !isLinked && (
            <div className="w-full text-left bg-amber-50 border border-amber-100 rounded-xl p-5 mt-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">Track Your Booking</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {isLoginMode 
                      ? "Sign in to keep track of this reservation." 
                      : "Create a password for your account to track your reservation easily."}
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleLinkAccount} className="space-y-3 mt-4">
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Enter a secure password"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-amber-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                {linkingError && (
                  <p className="text-red-500 text-xs font-medium">{linkingError}</p>
                )}
                
                <Button 
                  type="submit" 
                  disabled={linkingLoading || !password}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {linkingLoading ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</span>
                  ) : (
                    <span className="flex items-center gap-2">
                       {isLoginMode ? 'Sign In & Link Booking' : 'Create Account'} <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>
              
              <div className="mt-4 text-center">
                <button 
                  onClick={() => { setIsLoginMode(!isLoginMode); setLinkingError(''); setPassword(''); }}
                  className="text-xs font-medium text-amber-700 hover:text-amber-800 underline underline-offset-2"
                >
                  {isLoginMode ? "Need a new account? Create one" : "Already have an account? Sign in"}
                </button>
              </div>
            </div>
          )}

          {isLinked && (
            <div className="w-full text-left bg-emerald-50 border border-emerald-100 rounded-xl p-5 mt-6 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-emerald-900 leading-tight">Account Connected</h3>
                <p className="text-xs text-emerald-700 mt-1">Your booking has been saved to your account. You can log in anytime to view it.</p>
              </div>
            </div>
          )}

          <Link href="/" className="w-full">
            <Button className="w-full">Return to Home</Button>
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
