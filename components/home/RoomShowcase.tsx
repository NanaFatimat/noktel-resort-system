'use client';

import { motion } from 'motion/react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Users, Maximize, BedDouble, Image as ImageIcon } from 'lucide-react';
import { useBooking } from '@/components/booking/BookingContext';
import { useRooms, Room } from '@/hooks/use-rooms';
import Link from 'next/link';

interface RoomShowcaseProps {
  limit?: number;
  hideViewAllButton?: boolean;
  initialRooms?: Room[];
}

export function RoomShowcase({ limit, hideViewAllButton = false, initialRooms }: RoomShowcaseProps) {
  const { openBookingModal } = useBooking();
  const { rooms: hookRooms, loading } = useRooms();

  const rooms = initialRooms || hookRooms;

  // Filter only available rooms for the showcase
  let availableRooms = rooms.filter(room => room.status === 'available');
  
  if (limit) {
    availableRooms = availableRooms.slice(0, limit);
  }

  return (
    <section className="py-20 md:py-32 lg:pt-40 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-amber-600 font-medium tracking-widest uppercase text-sm mb-3">
              Luxury Accommodation
            </h2>
            <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
              Rooms & Suites
            </h3>
          </div>
          {!hideViewAllButton && (
            <Link href="/rooms">
              <Button variant="outline" className="w-fit">View All Rooms</Button>
            </Link>
          )}
        </div>

        {(!initialRooms && loading) ? (
          <div className="py-20 text-center text-slate-500">Loading rooms...</div>
        ) : availableRooms.length === 0 ? (
          <div className="py-20 text-center text-slate-500">No rooms available at the moment.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {availableRooms.map((room, index) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="group rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-xl transition-all duration-300 flex flex-col"
              >
                <div className="relative h-64 overflow-hidden bg-slate-100">
                  {room.image && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      className="relative w-full h-full"
                    >
                      <Image
                        src={room.image}
                        alt={room.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}
                  {!room.image && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                    <p className="font-bold text-slate-900">
                      ₦{room.price.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ night</span>
                    </p>
                  </div>
                </div>
                
                <div className="p-6 flex flex-col flex-1">
                  <h4 className="text-2xl font-serif font-bold text-slate-900 mb-2">{room.name}</h4>
                  <p className="text-slate-600 mb-6 flex-1">{room.description || 'Experience comfort and luxury in this beautifully appointed room.'}</p>
                  
                  <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6 mb-6">
                    <div className="flex flex-col items-center text-center gap-1">
                      <Users className="w-5 h-5 text-amber-600" />
                      <span className="text-xs text-slate-500 font-medium">{room.capacity} Guests</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1 border-x border-slate-100">
                      <Maximize className="w-5 h-5 text-amber-600" />
                      <span className="text-xs text-slate-500 font-medium">{room.size || 'Standard'}</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-1">
                      <BedDouble className="w-5 h-5 text-amber-600" />
                      <span className="text-xs text-slate-500 font-medium">{room.bed || 'Standard Bed'}</span>
                    </div>
                  </div>
                  
                  <Button className="w-full" onClick={openBookingModal}>Book This Room</Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
