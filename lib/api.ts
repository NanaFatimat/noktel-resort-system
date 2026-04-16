import firebaseConfig from '../firebase-config.json';
import { Room } from '@/hooks/use-rooms';
import { SiteSettings } from '@/hooks/use-settings';

export async function getRoomsServer(): Promise<Room[]> {
  const projectId = firebaseConfig.projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/rooms`;
  
  try {
    // Fetch with Next.js cache (revalidate every 60 seconds)
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.documents) return [];
    
    return data.documents.map((doc: any) => {
      const fields = doc.fields;
      return {
        id: doc.name.split('/').pop(),
        name: fields.name?.stringValue || '',
        type: fields.type?.stringValue || 'standard',
        price: fields.price?.integerValue ? parseInt(fields.price.integerValue) : 0,
        capacity: fields.capacity?.integerValue ? parseInt(fields.capacity.integerValue) : 2,
        status: fields.status?.stringValue || 'available',
        description: fields.description?.stringValue || '',
        image: fields.image?.stringValue || '',
        size: fields.size?.stringValue || '',
        bed: fields.bed?.stringValue || '',
      };
    });
  } catch (error) {
    console.error("Error fetching rooms on server:", error);
    return [];
  }
}

export async function getSettingsServer(): Promise<SiteSettings> {
  const projectId = firebaseConfig.projectId;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/homepage`;
  
  const defaultSettings = {
    heroImage: 'https://picsum.photos/seed/luxuryhotel/1920/1080',
    roomsHeroImage: 'https://picsum.photos/seed/noktelrooms/1920/1080',
    amenitiesHeroImage: 'https://picsum.photos/seed/noktelamenities/1920/1080',
    contactHeroImage: 'https://picsum.photos/seed/noktelcontact/1920/1080',
    poolImage: 'https://picsum.photos/seed/noktelpool/800/1000'
  };

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return defaultSettings;
    
    const data = await res.json();
    if (!data.fields) return defaultSettings;
    
    const fields = data.fields;
    return {
      heroImage: fields.heroImage?.stringValue || defaultSettings.heroImage,
      roomsHeroImage: fields.roomsHeroImage?.stringValue || defaultSettings.roomsHeroImage,
      amenitiesHeroImage: fields.amenitiesHeroImage?.stringValue || defaultSettings.amenitiesHeroImage,
      contactHeroImage: fields.contactHeroImage?.stringValue || defaultSettings.contactHeroImage,
      poolImage: fields.poolImage?.stringValue || defaultSettings.poolImage,
    };
  } catch (error) {
    console.error("Error fetching settings on server:", error);
    return defaultSettings;
  }
}
