import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

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
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to avoid unhandled promise rejection loops in UI components
}

export interface Booking {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  roomId: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  source: 'web' | 'phone';
  createdAt: string;
  paymentStatus?: 'paid' | 'unpaid';
  paymentMethod?: 'pay_at_hotel' | 'stripe';
}

export function useBookings(customerId?: string) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) {
       // eslint-disable-next-line react-hooks/set-state-in-effect
       setLoading(false);
       return;
    }

    setLoading(true);

    let q;
    if (customerId) {
        q = query(collection(db, 'bookings'), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
    } else {
        q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedBookings: Booking[] = [];
      querySnapshot.forEach((doc) => {
        fetchedBookings.push({ id: doc.id, ...doc.data() } as Booking);
      });
      setBookings(fetchedBookings);
      setLoading(false);
    }, (err: any) => {
      console.error("Error fetching bookings:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser, customerId]);

  return { bookings, loading, error };
}
