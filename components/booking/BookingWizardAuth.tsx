'use client';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export function BookingWizardAuth({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        onAuthenticated();
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
          role: 'customer',
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          phone,
          email,
          createdAt: new Date().toISOString()
        });
        onAuthenticated();
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use. Please sign in instead.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {isLoginMode ? 'Sign In to Continue' : 'Create an Account'}
        </h3>
        <p className="text-sm text-slate-500">
          You must have an account to complete your booking.
        </p>
      </div>
      
      <form onSubmit={handleAuth} className="space-y-4">
        {!isLoginMode && (
          <>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">First Name</label>
                <input type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 outline-none mt-1" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium text-slate-700">Last Name</label>
                <input type="text" required value={lastName} onChange={e => setLastName(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 outline-none mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Phone</label>
              <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 outline-none mt-1" />
            </div>
          </>
        )}
        
        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 outline-none mt-1" />
        </div>
        
        <div>
          <label className="text-sm font-medium text-slate-700">Password</label>
          <div className="relative mt-1">
            <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 outline-none" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-slate-400">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Please wait...' : (isLoginMode ? 'Sign In' : 'Create Account')}
        </Button>
      </form>
      
      <div className="text-center text-sm">
        <button onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }} className="text-amber-600 hover:underline">
          {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
