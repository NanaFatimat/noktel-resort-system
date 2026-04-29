'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Phone, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { useBooking } from '@/components/booking/BookingContext';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const forceDarkText = pathname?.startsWith('/admin') || pathname?.startsWith('/booking');
  const forceScrolledStyle = isScrolled || forceDarkText;

  const { openBookingModal } = useBooking();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string>('Guest');
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists() && userDoc.data().role) {
            setUserRole(userDoc.data().role.charAt(0).toUpperCase() + userDoc.data().role.slice(1));
          } else if (currentUser.email === 'admin@noktel.com' || currentUser.email === 'test@example.com') { // fallback
            setUserRole('Admin');
          } else {
            setUserRole('Guest');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole(currentUser.email === 'admin@noktel.com' ? 'Admin' : 'Guest');
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Rooms & Suites', href: '/rooms' },
    { name: 'Dining & Amenities', href: '/amenities' },
    { name: 'Contact', href: '/contact' },
  ];

  const handleSignOut = async () => {
    await signOut(auth);
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        forceScrolledStyle ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className={`font-serif text-2xl font-bold tracking-tight ${forceScrolledStyle ? 'text-slate-900' : 'text-white'}`}>
              Noktel <span className="text-amber-500">Resort</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-amber-500 ${
                  forceScrolledStyle ? 'text-slate-600' : 'text-white/90'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4 relative">
            <Button variant={forceScrolledStyle ? 'outline' : 'secondary'} className="hidden lg:flex gap-2">
              <Phone className="w-4 h-4" />
              <span>+234 800 NOKTEL</span>
            </Button>
            
            {!authLoading && (
              user ? (
                <div className="relative">
                  <Button 
                    variant={forceScrolledStyle ? 'outline' : 'secondary'} 
                    size="icon" 
                    className="rounded-full flex items-center justify-center p-0 w-10 h-10"
                    onClick={() => setShowUserMenu(!showUserMenu)}
                  >
                    <User className="w-5 h-5" />
                  </Button>
                  
                  {/* User Dropdown */}
                  <AnimatePresence>
                    {showUserMenu && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 top-full z-50 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                          <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
                          <p className="text-xs text-slate-500 capitalize mt-0.5">{userRole} Account</p>
                        </div>
                        <Link href="/admin" className="flex flex-col">
                          <span className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
                            <Menu className="w-4 h-4" /> Dashboard
                          </span>
                        </Link>
                        <button 
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                        >
                          <LogOut className="w-4 h-4" /> Sign out
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link href="/admin">
                  <Button variant="ghost" className={forceScrolledStyle ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/20'}>
                    Sign In
                  </Button>
                </Link>
              )
            )}
            
            <Button onClick={openBookingModal} className="shadow-md">Book Now</Button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-3">
             {!authLoading && user && (
              <Link href="/admin">
                <Button variant={forceScrolledStyle ? 'outline' : 'secondary'} size="icon" className="w-9 h-9 rounded-full">
                  <User className="w-4 h-4" />
                </Button>
              </Link>
             )}
            <button
              className={`p-2 rounded-lg transition-colors ${forceScrolledStyle ? 'text-slate-900 hover:bg-slate-100' : 'text-white hover:bg-white/20'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t mt-3 shadow-xl absolute top-full left-0 right-0 max-h-[85vh] overflow-y-auto"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {!authLoading && !user && (
                <Link
                  href="/admin"
                  className="flex items-center gap-3 text-slate-700 font-medium py-3 px-4 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 mb-2"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <User className="w-5 h-5 text-amber-600" />
                  Sign In / Register
                </Link>
              )}
              
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-slate-600 font-medium py-3 px-4 rounded-lg hover:bg-slate-50 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              
              <div className="flex flex-col gap-3 pt-4 pb-2 border-t border-slate-100 mt-2">
                <Button variant="outline" className="w-full justify-center gap-2 h-12 text-base">
                  <Phone className="w-5 h-5 text-amber-600" />
                  <span>Call Us</span>
                </Button>
                <Button className="w-full justify-center h-12 text-base shadow-md" onClick={() => {
                  setIsMobileMenuOpen(false);
                  openBookingModal();
                }}>Book Now</Button>
              </div>
              
              {!authLoading && user && (
                 <button 
                   onClick={handleSignOut}
                   className="w-full flex items-center justify-center gap-2 py-3 mt-2 text-red-600 font-medium bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                 >
                   <LogOut className="w-5 h-5" />
                   Sign Out
                 </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

