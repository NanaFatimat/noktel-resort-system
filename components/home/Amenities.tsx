'use client';

import { motion } from 'motion/react';
import { Wifi, Coffee, Waves, Dumbbell, Utensils, Car } from 'lucide-react';

const amenities = [
  {
    icon: <Waves className="w-8 h-8" />,
    title: "Swimming Pool",
    description: "Relax and unwind in our temperature-controlled outdoor pool."
  },
  {
    icon: <Utensils className="w-8 h-8" />,
    title: "Fine Dining",
    description: "Experience culinary excellence at our signature restaurant."
  },
  {
    icon: <Wifi className="w-8 h-8" />,
    title: "High-Speed Wi-Fi",
    description: "Stay connected with complimentary high-speed internet access."
  },
  {
    icon: <Dumbbell className="w-8 h-8" />,
    title: "Fitness Center",
    description: "Keep up with your routine in our fully equipped modern gym."
  },
  {
    icon: <Coffee className="w-8 h-8" />,
    title: "Lounge & Bar",
    description: "Enjoy premium beverages and cocktails in a relaxing atmosphere."
  },
  {
    icon: <Car className="w-8 h-8" />,
    title: "Secure Parking",
    description: "Complimentary secure valet parking for all our guests."
  }
];

export function Amenities() {
  return (
    <section className="py-20 md:py-32 bg-zinc-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-amber-600 font-medium tracking-widest uppercase text-sm mb-3">
            World-Class Facilities
          </h2>
          <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-6">
            Everything You Need For A Perfect Stay
          </h3>
          <p className="text-slate-600 text-lg">
            At Noktel Resort Hotel, we provide an array of premium amenities designed to make your stay as comfortable and enjoyable as possible.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {amenities.map((amenity, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
            >
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                {amenity.icon}
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-3">{amenity.title}</h4>
              <p className="text-slate-600 leading-relaxed">
                {amenity.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
