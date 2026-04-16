import { Hero } from '@/components/home/Hero';
import { RoomShowcase } from '@/components/home/RoomShowcase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getRoomsServer, getSettingsServer } from '@/lib/api';
import { PoolSection } from '@/components/home/PoolSection';

export default async function Home() {
  const [rooms, settings] = await Promise.all([
    getRoomsServer(),
    getSettingsServer()
  ]);

  return (
    <>
      <Hero initialSettings={settings} />
      
      {/* Featured Rooms Section */}
      <RoomShowcase limit={3} initialRooms={rooms} />

      {/* Quick Amenities Summary */}
      <section className="py-20 bg-slate-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-amber-600 font-medium tracking-widest uppercase text-sm">
                World-Class Facilities
              </h2>
              <h3 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
                More Than Just a Room
              </h3>
              <p className="text-lg text-slate-600">
                At Noktel Resort, we offer a comprehensive luxury experience. From our award-winning restaurant to our serene spa and state-of-the-art fitness center, every aspect of your stay is designed for perfection.
              </p>
              <ul className="space-y-3 text-slate-700 font-medium">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" /> Fine Dining Restaurant
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" /> Infinity Pool & Cabanas
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" /> Executive Conference Rooms
                </li>
              </ul>
              <div className="pt-4">
                <Link href="/amenities">
                  <Button size="lg">Explore All Amenities</Button>
                </Link>
              </div>
            </div>
            <div className="flex-1 relative h-[500px] w-full rounded-2xl overflow-hidden shadow-xl bg-slate-200">
              <PoolSection poolImage={settings.poolImage} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
