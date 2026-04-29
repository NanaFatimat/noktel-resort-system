'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { doc, updateDoc, setDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, CalendarDays, BedDouble, Settings, LogOut, Users, TrendingUp, Image as ImageIcon, Upload, Plus, Trash2, Shield, Key } from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { useRooms } from '@/hooks/use-rooms';
import { useSettings } from '@/hooks/use-settings';

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.");
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
  }

  const data = await response.json();
  return data.secure_url;
}

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

export function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'customer' | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const { bookings, loading: bookingsLoading } = useBookings(userRole === 'customer' ? user?.uid : undefined);
  const { rooms, loading: roomsLoading } = useRooms();

  const { settings } = useSettings();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingRoomsImage, setUploadingRoomsImage] = useState(false);
  const [uploadingAmenitiesImage, setUploadingAmenitiesImage] = useState(false);
  const [uploadingContactImage, setUploadingContactImage] = useState(false);
  const [uploadingPoolImage, setUploadingPoolImage] = useState(false);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    type: 'standard',
    price: 0,
    capacity: 2,
    size: '',
    bed: '',
    description: '',
    status: 'available'
  });
  const [newRoomImage, setNewRoomImage] = useState<File | null>(null);
  const [uploadingRoom, setUploadingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          import('firebase/firestore').then(async ({ doc, getDoc }) => {
             const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
             const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
             if (adminDoc.exists()) {
               setUserRole('admin');
             } else if (userDoc.exists() && userDoc.data().role === 'customer') {
               setUserRole('customer');
             } else {
               setUserRole(currentUser.email === 'admin@noktel.com' || currentUser.email === 'test@example.com' ? 'admin' : 'customer');
             }
             setLoadingAuth(false);
          });
        } catch(e) {
          console.error(e);
          setLoadingAuth(false);
        }
      } else {
        setUserRole(null);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // 1. Create the user
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        if (inviteCode) {
          // 2. Register as admin using the invite code
          await setDoc(doc(db, 'admins', userCred.user.uid), {
            email: userCred.user.email,
            inviteCode: inviteCode,
            role: 'admin',
            createdAt: new Date().toISOString()
          });

          // 3. Clear the invite code so it can't be reused
          try {
            await deleteDoc(doc(db, 'admin_invites', inviteCode));
          } catch(e) {
            console.log("Could not clear invite code.");
          }
        } else {
          // Normal customer registration
          await setDoc(doc(db, 'users', userCred.user.uid), {
            role: 'customer',
            name: email.split('@')[0],
            email: email,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.error("Auth Error", err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('Email already in use. Please sign in instead.');
      } else if (err.message && err.message.includes('Missing or insufficient permissions')) {
        setAuthError('Invalid or expired Invite Code.');
        if (auth.currentUser) await signOut(auth);
      } else {
        setAuthError(err.message || 'Authentication failed. Please try again.');
        if (!isLoginMode && auth.currentUser) await signOut(auth);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleUpdateRoomStatus = async (roomId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      setRoomToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rooms/${roomId}`);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingRoom(true);
    setDashboardError(null);
    try {
      let imageUrl = editingRoomId ? rooms.find(r => r.id === editingRoomId)?.image || '' : '';
      if (newRoomImage) {
        imageUrl = await uploadToCloudinary(newRoomImage);
      }

      const roomData = {
        ...newRoom,
        image: imageUrl || 'https://picsum.photos/seed/noktelroom/800/600',
      };

      if (editingRoomId) {
        await updateDoc(doc(db, 'rooms', editingRoomId), roomData);
      } else {
        await addDoc(collection(db, 'rooms'), roomData);
      }

      setIsAddingRoom(false);
      setEditingRoomId(null);
      setNewRoom({
        name: '',
        type: 'standard',
        price: 0,
        capacity: 2,
        size: '',
        bed: '',
        description: '',
        status: 'available'
      });
      setNewRoomImage(null);
    } catch (error) {
      console.error("Error saving room:", error);
      setDashboardError("Failed to save room.");
    } finally {
      setUploadingRoom(false);
    }
  };

  const handleEditClick = (room: any) => {
    setEditingRoomId(room.id);
    setNewRoom({
      name: room.name,
      type: room.type,
      price: room.price,
      capacity: room.capacity,
      size: room.size || '',
      bed: room.bed || '',
      description: room.description || '',
      status: room.status
    });
    setIsAddingRoom(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const downloadURL = await uploadToCloudinary(file);
      await setDoc(doc(db, 'settings', 'homepage'), {
        heroImage: downloadURL
      }, { merge: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setDashboardError("Failed to upload image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRoomsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRoomsImage(true);
    try {
      const downloadURL = await uploadToCloudinary(file);
      await setDoc(doc(db, 'settings', 'homepage'), {
        roomsHeroImage: downloadURL
      }, { merge: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setDashboardError("Failed to upload image. Please try again.");
    } finally {
      setUploadingRoomsImage(false);
    }
  };

  const handleAmenitiesImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAmenitiesImage(true);
    setDashboardError(null);
    try {
      const downloadURL = await uploadToCloudinary(file);

      await setDoc(doc(db, 'settings', 'homepage'), {
        amenitiesHeroImage: downloadURL
      }, { merge: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setDashboardError("Failed to upload image. Please try again.");
    } finally {
      setUploadingAmenitiesImage(false);
    }
  };

  const handleContactImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingContactImage(true);
    setDashboardError(null);
    try {
      const downloadURL = await uploadToCloudinary(file);

      await setDoc(doc(db, 'settings', 'homepage'), {
        contactHeroImage: downloadURL
      }, { merge: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setDashboardError("Failed to upload image. Please try again.");
    } finally {
      setUploadingContactImage(false);
    }
  };

  const handlePoolImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPoolImage(true);
    setDashboardError(null);
    try {
      const downloadURL = await uploadToCloudinary(file);

      await setDoc(doc(db, 'settings', 'homepage'), {
        poolImage: downloadURL
      }, { merge: true });
    } catch (error) {
      console.error("Error uploading image:", error);
      setDashboardError("Failed to upload image. Please try again.");
    } finally {
      setUploadingPoolImage(false);
    }
  };

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 pt-20">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 pt-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-serif font-bold text-slate-900">
              {isLoginMode ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              {isLoginMode ? 'Sign in to your Noktel account' : 'Register to manage your bookings'}
            </p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                required
              />
            </div>
            
            {!isLoginMode && (
              <div>
                <label className="text-sm font-medium text-slate-700 flex justify-between">
                  <span>Invite Code</span>
                  <span className="text-slate-400 font-normal text-xs">(optional - for staff only)</span>
                </label>
                <input 
                  type="text" 
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1 font-mono uppercase tracking-widest placeholder:text-slate-300"
                  placeholder="e.g. NOKTEL-123"
                />
              </div>
            )}
            
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            
            <Button type="submit" className="w-full h-12 text-base">
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </Button>
            
            <div className="text-center mt-4 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setInviteCode(''); }}
                className="text-sm text-slate-500 hover:text-amber-600 font-medium transition-colors"
              >
                {isLoginMode ? "Need an account? Register here" : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  if (userRole === 'customer') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pt-[72px]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col md:h-[calc(100vh-72px)] sticky top-[72px]">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-serif font-bold text-white">Noktel <span className="text-amber-500">Guest</span></h2>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors bg-amber-600 text-white"
            >
              <CalendarDays className="w-5 h-5" /> My Bookings
            </button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto">
          <header className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My Bookings</h1>
              <p className="text-slate-500 mt-1">Welcome back, {user.email}</p>
            </div>
          </header>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm">
                    <th className="p-4 font-medium">Room</th>
                    <th className="p-4 font-medium">Check In/Out</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsLoading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading your bookings...</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-slate-500">You do not have any reservations yet.</td></tr>
                  ) : bookings.map(booking => (
                    <tr key={booking.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-4 text-slate-700">
                        <p className="font-medium text-slate-900">{booking.roomName}</p>
                        <p className="text-xs text-slate-500">{booking.guests} Guests</p>
                      </td>
                      <td className="p-4 text-slate-700 text-sm">
                        <p>{new Date(booking.checkIn).toLocaleDateString()}</p>
                        <p className="text-slate-400">to</p>
                        <p>{new Date(booking.checkOut).toLocaleDateString()}</p>
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        ₦{booking.totalAmount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // Calculate Stats
  const realizedRevenue = bookings
    .filter(b => b.paymentStatus === 'paid')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);
    
  const expectedRevenue = bookings
    .filter(b => b.paymentMethod === 'pay_at_hotel' && b.paymentStatus !== 'paid' && b.status !== 'cancelled')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  
  // Pending actions: either status is pending, or it's a confirmed pay_at_hotel booking that hasn't been paid yet
  const pendingActionBookings = bookings.filter(b => 
    b.status === 'pending' || 
    (b.paymentMethod === 'pay_at_hotel' && b.paymentStatus !== 'paid' && b.status === 'confirmed')
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pt-[72px]">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col md:h-[calc(100vh-72px)] sticky top-[72px]">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-serif font-bold text-white">Noktel <span className="text-amber-500">Admin</span></h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'bookings' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <CalendarDays className="w-5 h-5" /> Bookings
          </button>
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'rooms' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <BedDouble className="w-5 h-5" /> Rooms
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <ImageIcon className="w-5 h-5" /> Website Settings
          </button>
          <button 
            onClick={() => setActiveTab('admins')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'admins' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Shield className="w-5 h-5" /> Access Control
          </button>
          <button 
            onClick={() => setActiveTab('admins')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'admins' ? 'bg-amber-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Shield className="w-5 h-5" /> Access Control
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 capitalize">{activeTab}</h1>
            <p className="text-slate-500 mt-1">Welcome back, {user.email}</p>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">₦{realizedRevenue.toLocaleString()}</p>
                  {expectedRevenue > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      + ₦{expectedRevenue.toLocaleString()} Expected (Pay at Hotel)
                    </p>
                  )}
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <CalendarDays className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Active Bookings</p>
                  <p className="text-2xl font-bold text-slate-900">{activeBookings.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Pending Action</p>
                  <p className="text-2xl font-bold text-slate-900">{pendingActionBookings}</p>
                </div>
              </div>
            </div>

            {/* Recent Bookings Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">Recent Bookings</h3>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('bookings')}>View All</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm">
                      <th className="p-4 font-medium">Guest</th>
                      <th className="p-4 font-medium">Room</th>
                      <th className="p-4 font-medium">Dates</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsLoading ? (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-500">Loading...</td></tr>
                    ) : bookings.slice(0, 5).map(booking => (
                      <tr key={booking.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{booking.customerName}</p>
                          <p className="text-xs text-slate-500">{booking.customerPhone}</p>
                        </td>
                        <td className="p-4 text-slate-700">{booking.roomName}</td>
                        <td className="p-4 text-slate-700 text-sm">
                          {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                            booking.source === 'phone' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {booking.source}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'bookings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm">
                    <th className="p-4 font-medium">Guest Details</th>
                    <th className="p-4 font-medium">Room</th>
                    <th className="p-4 font-medium">Check In/Out</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingsLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading bookings...</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">No bookings found.</td></tr>
                  ) : bookings.map(booking => (
                    <tr key={booking.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{booking.customerName}</p>
                        <p className="text-xs text-slate-500">{booking.customerEmail}</p>
                        <p className="text-xs text-slate-500">{booking.customerPhone}</p>
                      </td>
                      <td className="p-4 text-slate-700">
                        <p className="font-medium">{booking.roomName}</p>
                        <p className="text-xs text-slate-500">{booking.guests} Guests</p>
                      </td>
                      <td className="p-4 text-slate-700 text-sm">
                        <p>{new Date(booking.checkIn).toLocaleDateString()}</p>
                        <p className="text-slate-400">to</p>
                        <p>{new Date(booking.checkOut).toLocaleDateString()}</p>
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        ₦{booking.totalAmount.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <select 
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize outline-none cursor-pointer ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}
                          value={booking.status}
                          onChange={(e) => handleUpdateBookingStatus(booking.id, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                          booking.source === 'phone' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {booking.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'rooms' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Manage Rooms</h2>
              <Button onClick={() => {
                setIsAddingRoom(!isAddingRoom);
                if (isAddingRoom) {
                  setEditingRoomId(null);
                  setNewRoom({ name: '', type: 'standard', price: 0, capacity: 2, size: '', bed: '', description: '', status: 'available' });
                }
              }}>
                {isAddingRoom ? 'Cancel' : <><Plus className="w-4 h-4 mr-2" /> Add New Room</>}
              </Button>
            </div>

            {dashboardError && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-6 flex justify-between items-center">
                <span>{dashboardError}</span>
                <button onClick={() => setDashboardError(null)} className="text-red-800 hover:text-red-900">&times;</button>
              </div>
            )}

            {isAddingRoom && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-4">{editingRoomId ? 'Edit Room' : 'Add New Room'}</h3>
                <form onSubmit={handleSaveRoom} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Room Name</label>
                      <input type="text" required value={newRoom.name} onChange={e => setNewRoom({...newRoom, name: e.target.value})} className="w-full p-2 border rounded-lg" placeholder="e.g. Ocean View Suite" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select value={newRoom.type} onChange={e => setNewRoom({...newRoom, type: e.target.value})} className="w-full p-2 border rounded-lg">
                        <option value="standard">Standard</option>
                        <option value="deluxe">Deluxe</option>
                        <option value="executive">Executive</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Price per night (₦)</label>
                      <input type="number" required min="0" value={newRoom.price} onChange={e => setNewRoom({...newRoom, price: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (Guests)</label>
                      <input type="number" required min="1" value={newRoom.capacity} onChange={e => setNewRoom({...newRoom, capacity: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Size (e.g. 40 sqm)</label>
                      <input type="text" required value={newRoom.size} onChange={e => setNewRoom({...newRoom, size: e.target.value})} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Bed Type (e.g. King Bed)</label>
                      <input type="text" required value={newRoom.bed} onChange={e => setNewRoom({...newRoom, bed: e.target.value})} className="w-full p-2 border rounded-lg" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea required rows={3} value={newRoom.description} onChange={e => setNewRoom({...newRoom, description: e.target.value})} className="w-full p-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Room Image</label>
                    <input type="file" accept="image/*" onChange={e => setNewRoomImage(e.target.files?.[0] || null)} className="w-full p-2 border rounded-lg" />
                  </div>
                  <Button type="submit" disabled={uploadingRoom} className="w-full">
                    {uploadingRoom ? 'Saving...' : 'Save Room'}
                  </Button>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roomsLoading ? (
                <div className="col-span-full py-10 text-center text-slate-500">Loading rooms...</div>
              ) : rooms.map(room => (
                <div key={room.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                  {room.image && (
                    <div className="relative h-40 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl bg-slate-100">
                      <motion.img 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        src={room.image} 
                        alt={room.name} 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{room.name}</h3>
                      <p className="text-sm text-slate-500 capitalize">{room.type}</p>
                    </div>
                    <select 
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize outline-none cursor-pointer ${
                        room.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                      value={room.status}
                      onChange={(e) => handleUpdateRoomStatus(room.id, e.target.value)}
                    >
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 mb-6 flex-1">
                    <div className="flex justify-between">
                      <span>Price per night:</span>
                      <span className="font-medium text-slate-900">₦{room.price.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Capacity:</span>
                      <span className="font-medium text-slate-900">{room.capacity} Guests</span>
                    </div>
                    {room.size && (
                      <div className="flex justify-between">
                        <span>Size:</span>
                        <span className="font-medium text-slate-900">{room.size}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    {roomToDelete === room.id ? (
                      <>
                        <Button variant="outline" className="flex-1 bg-red-600 text-white hover:bg-red-700 hover:text-white border-red-600" onClick={() => handleDeleteRoom(room.id)}>Confirm Delete</Button>
                        <Button variant="outline" className="flex-1" onClick={() => setRoomToDelete(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" className="flex-1" onClick={() => handleEditClick(room)}>Edit</Button>
                        <Button variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setRoomToDelete(room.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Homepage Hero Image</h3>
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {settings.heroImage ? (
                    <motion.img 
                      key={settings.heroImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      src={settings.heroImage} 
                      alt="Hero" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-700">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    id="hero-image-upload"
                    disabled={uploadingImage}
                  />
                  <label 
                    htmlFor="hero-image-upload" 
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      uploadingImage ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {uploadingImage ? 'Uploading...' : 'Change Hero Image'}
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 1920x1080px. Max file size: 5MB.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Rooms Page Hero Image</h3>
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {settings.roomsHeroImage ? (
                    <motion.img 
                      key={settings.roomsHeroImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      src={settings.roomsHeroImage} 
                      alt="Rooms Hero" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  {uploadingRoomsImage && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-700">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleRoomsImageUpload} 
                    className="hidden" 
                    id="rooms-hero-image-upload"
                    disabled={uploadingRoomsImage}
                  />
                  <label 
                    htmlFor="rooms-hero-image-upload" 
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      uploadingRoomsImage ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {uploadingRoomsImage ? 'Uploading...' : 'Change Rooms Hero Image'}
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 1920x1080px. Max file size: 5MB.</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Amenities Page Hero Image</h3>
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {settings.amenitiesHeroImage ? (
                    <motion.img 
                      key={settings.amenitiesHeroImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      src={settings.amenitiesHeroImage} 
                      alt="Amenities Hero" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  {uploadingAmenitiesImage && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-700">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAmenitiesImageUpload} 
                    className="hidden" 
                    id="amenities-image-upload"
                    disabled={uploadingAmenitiesImage}
                  />
                  <label 
                    htmlFor="amenities-image-upload" 
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      uploadingAmenitiesImage ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {uploadingAmenitiesImage ? 'Uploading...' : 'Change Amenities Hero'}
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 1920x1080px. Max file size: 5MB.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Contact Page Hero Image</h3>
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {settings.contactHeroImage ? (
                    <motion.img 
                      key={settings.contactHeroImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      src={settings.contactHeroImage} 
                      alt="Contact Hero" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  {uploadingContactImage && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-700">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleContactImageUpload} 
                    className="hidden" 
                    id="contact-image-upload"
                    disabled={uploadingContactImage}
                  />
                  <label 
                    htmlFor="contact-image-upload" 
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      uploadingContactImage ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {uploadingContactImage ? 'Uploading...' : 'Change Contact Hero'}
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 1920x1080px. Max file size: 5MB.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Homepage Pool Section Image</h3>
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {settings.poolImage ? (
                    <motion.img 
                      key={settings.poolImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      src={settings.poolImage} 
                      alt="Pool Section" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-50" />
                    </div>
                  )}
                  {uploadingPoolImage && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-slate-700">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePoolImageUpload} 
                    className="hidden" 
                    id="pool-image-upload"
                    disabled={uploadingPoolImage}
                  />
                  <label 
                    htmlFor="pool-image-upload" 
                    className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer ${
                      uploadingPoolImage ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    {uploadingPoolImage ? 'Uploading...' : 'Change Pool Image'}
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Recommended size: 800x1000px. Max file size: 5MB.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'admins' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Security & Access Management</h2>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Create Admin Invite Code</h3>
              <p className="text-slate-500 mb-6 text-sm">Generate a one-time code to allow your client or staff to create their own admin account. They can use this code on the login screen by clicking &quot;Need an account? Register here&quot;.</p>
              
              {!generatedCode ? (
                <Button onClick={async () => {
                  try {
                    const code = 'NOKTEL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                    await setDoc(doc(db, 'admin_invites', code), {
                      createdBy: user?.email,
                      createdAt: new Date().toISOString()
                    });
                    setGeneratedCode(code);
                  } catch (err) {
                    console.error("Failed to generate code:", err);
                    alert("Failed to generate code. Please check your permissions.");
                  }
                }}>
                  <Key className="w-5 h-5 mr-2" />
                  Generate Invite Code
                </Button>
              ) : (
                <div className="p-6 bg-amber-50 rounded-xl border border-amber-200 flex flex-col gap-3">
                  <p className="text-sm font-medium text-amber-900">Share this code securely with the recipient:</p>
                  <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-amber-200 w-fit">
                    <p className="text-3xl font-mono font-bold tracking-widest text-amber-700">{generatedCode}</p>
                  </div>
                  <p className="text-xs text-amber-700 max-w-md">When they go to the account URL, they should select &quot;Create Account&quot; and enter this exact code. This code can only be used once.</p>
                  <Button variant="outline" className="w-fit mt-4 bg-white hover:bg-amber-50" onClick={() => setGeneratedCode(null)}>
                    Generate Another Code
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
