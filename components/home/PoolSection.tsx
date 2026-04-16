'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

export function PoolSection({ poolImage }: { poolImage: string }) {
  if (!poolImage) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
      className="relative w-full h-full"
    >
      <Image 
        src={poolImage} 
        alt="Noktel Pool" 
        fill 
        className="object-cover"
        referrerPolicy="no-referrer"
      />
    </motion.div>
  );
}
