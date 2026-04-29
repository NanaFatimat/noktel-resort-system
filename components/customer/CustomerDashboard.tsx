'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { CalendarDays, LogOut, Shield, Eye, EyeOff } from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';

export function CustomerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const [isLoginMode, setIsLoginMode] = useState(true);

  const { bookings, loading: bookingsLoading } = useBookings(user?.uid);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        document.cookie = `noktel_role=customer; path=/;`;
      } else {
        document.cookie = "noktel_role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
      setLoadingAuth(false);
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
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCred.user.uid), {
          role: 'customer',
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
          phone,
          email: email,
          createdAt: new Date().toISOString()
        });
        
        try {
          await sendEmailVerification(userCred.user);
        } catch (verifyErr) {
          console.error("Verification email failed to send:", verifyErr);
        }
      }
    } catch (err: any) {
      console.error("Auth Error", err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('Email already in use. Please sign in instead.');
      } else {
        setAuthError(err.message || 'Authentication failed. Please try again.');
        if (!isLoginMode && auth.currentUser) await signOut(auth);
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setAuthError('Please enter your email address to reset your password.');
      return;
    }
    setAuthError('');
    setResetEmailSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (error: any) {
      console.error(error);
      setAuthError(error.message || 'Failed to send password reset email.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
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
            {!isLoginMode && (
              <>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-700">First Name</label>
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-700">Last Name</label>
                    <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone Number</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none mt-1"
                    required
                  />
                </div>
              </>
            )}
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
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Password</label>
                {isLoginMode && (
                  <button 
                    type="button" 
                    onClick={handlePasswordReset}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {resetEmailSent && <p className="text-green-600 text-sm">Password reset email sent. Please check your inbox.</p>}
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            
            <Button type="submit" className="w-full h-12 text-base">
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </Button>
            
            <div className="text-center mt-4 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }}
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

  if (!user.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pt-[72px]">
        <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col md:h-[calc(100vh-72px)] sticky top-[72px]">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-xl font-serif font-bold text-white">Noktel <span className="text-amber-500">Guest</span></h2>
          </div>
          <div className="p-4 border-t border-slate-800 mt-auto">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </aside>
        <main className="flex-1 p-6 md:p-10 flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center">
                <Shield className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify your email</h2>
                <p className="text-slate-500 mb-6">We&apos;ve sent a verification link to {user.email}. Please check your inbox and verify your account to access your bookings. You may need to refresh the page after verifying.</p>
                <Button className="w-full" onClick={async () => {
                    try {
                        await sendEmailVerification(user);
                        alert("Verification email resent!");
                    } catch(e) {
                        alert("Wait a moment before requesting another email.");
                    }
                }}>
                  Resend Verification Email
                </Button>
            </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pt-[72px]">
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col md:h-[calc(100vh-72px)] sticky top-[72px]">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-serif font-bold text-white">Noktel <span className="text-amber-500">Guest</span></h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors bg-amber-600 text-white">
            <CalendarDays className="w-5 h-5" /> My Bookings
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

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
