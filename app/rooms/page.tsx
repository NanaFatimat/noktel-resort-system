'use client';

import { RoomShowcase } from '@/components/home/RoomShowcase';
import Image from 'next/image';
import { useSettings } from '@/hooks/use-settings';
import { motion } from 'motion/react';

export default function RoomsPage() {
  const { settings, loading } = useSettings();

  return (
    <div className="pt-24 pb-12">
      {/* Page Header */}
      <section className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden mb-12 bg-slate-900">
        <div className="absolute inset-0 z-0">
          {settings.roomsHeroImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              className="relative w-full h-full"
            >
              <Image
                src={settings.roomsHeroImage}
                alt="Noktel Rooms"
                fill
                className="object-cover"
                priority
                referrerPolicy="no-referrer"
              />
            </motion.div>
          )}
          <div className="absolute inset-0 bg-slate-900/60" />
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-4">
            Our Rooms & Suites
          </h1>
          <p className="text-lg text-slate-200 max-w-2xl mx-auto font-light">
            Experience the perfect blend of comfort, style, and luxury in every room.
          </p>
        </div>
      </section>

      {/* Reusing the RoomShowcase component for now, but we could expand it to fetch from Firestore */}
      <RoomShowcase hideViewAllButton={true} />
    </div>
  );
}
