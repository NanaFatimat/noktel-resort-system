'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Calendar, Users, PhoneCall } from 'lucide-react';
import Image from 'next/image';
import { useBooking } from '@/components/booking/BookingContext';
import { useSettings } from '@/hooks/use-settings';

export function Hero() {
  const { openBookingModal } = useBooking();
  const { settings, loading } = useSettings();

  return (
    <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-slate-900">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        {settings.heroImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="relative w-full h-full"
          >
            <Image
              src={settings.heroImage}
              alt="Noktel Resort Hotel Exterior"
              fill
              className="object-cover"
              priority
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-slate-900/60" /> {/* Dark overlay */}
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-3xl mx-auto space-y-6"
        >
          <h2 className="text-amber-500 font-medium tracking-widest uppercase text-sm md:text-base">
            Welcome to Ilorin&apos;s Finest
          </h2>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-tight">
            Experience Unmatched <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
              Luxury & Comfort
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-200 max-w-2xl mx-auto font-light">
            Discover a sanctuary of elegance at Noktel Resort Hotel. Whether for business or leisure, your perfect stay begins here.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Button size="lg" className="w-full sm:w-auto text-base h-14 px-8" onClick={openBookingModal}>
              Book Your Stay
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-14 px-8 bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white backdrop-blur-sm">
              <PhoneCall className="w-5 h-5 mr-2" />
              Try AI Voice Booking
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Quick Booking Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        className="absolute bottom-8 left-0 right-0 z-20 hidden lg:block"
      >
        <div className="container mx-auto px-6">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-2 flex items-center justify-between gap-2 max-w-5xl mx-auto border border-white/20">
            <div className="flex-1 flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer" onClick={openBookingModal}>
              <Calendar className="w-5 h-5 text-amber-600" />
              <div className="text-left">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Check-in</p>
                <p className="text-sm font-bold text-slate-900">Select Date</p>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="flex-1 flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer" onClick={openBookingModal}>
              <Calendar className="w-5 h-5 text-amber-600" />
              <div className="text-left">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Check-out</p>
                <p className="text-sm font-bold text-slate-900">Select Date</p>
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div className="flex-1 flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors rounded-xl cursor-pointer" onClick={openBookingModal}>
              <Users className="w-5 h-5 text-amber-600" />
              <div className="text-left">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Guests</p>
                <p className="text-sm font-bold text-slate-900">2 Adults</p>
              </div>
            </div>
            <Button size="lg" className="px-10 h-14 rounded-xl font-bold text-base shadow-lg shadow-amber-500/20" onClick={openBookingModal}>
              Check Availability
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
