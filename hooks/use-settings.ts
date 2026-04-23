import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface SiteSettings {
  heroImage: string;
  roomsHeroImage: string;
  amenitiesHeroImage: string;
  contactHeroImage: string;
  poolImage: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>({
    heroImage: '', 
    roomsHeroImage: '',
    amenitiesHeroImage: '',
    contactHeroImage: '',
    poolImage: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'homepage'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({
          heroImage: data.heroImage || 'https://picsum.photos/seed/luxuryhotel/1920/1080',
          roomsHeroImage: data.roomsHeroImage || 'https://picsum.photos/seed/noktelrooms/1920/1080',
          amenitiesHeroImage: data.amenitiesHeroImage || 'https://picsum.photos/seed/noktelamenities/1920/1080',
          contactHeroImage: data.contactHeroImage || 'https://picsum.photos/seed/noktelcontact/1920/1080',
          poolImage: data.poolImage || 'https://picsum.photos/seed/noktelpool/800/1000'
        });
      } else {
        setSettings({
          heroImage: 'https://picsum.photos/seed/luxuryhotel/1920/1080',
          roomsHeroImage: 'https://picsum.photos/seed/noktelrooms/1920/1080',
          amenitiesHeroImage: 'https://picsum.photos/seed/noktelamenities/1920/1080',
          contactHeroImage: 'https://picsum.photos/seed/noktelcontact/1920/1080',
          poolImage: 'https://picsum.photos/seed/noktelpool/800/1000'
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { settings, loading };
}
