import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const initialRooms = [
  {
    name: 'Standard 101',
    type: 'standard',
    price: 45000,
    capacity: 2,
    status: 'available'
  },
  {
    name: 'Standard 102',
    type: 'standard',
    price: 45000,
    capacity: 2,
    status: 'available'
  },
  {
    name: 'Deluxe 201',
    type: 'deluxe',
    price: 75000,
    capacity: 2,
    status: 'available'
  },
  {
    name: 'Executive Suite 301',
    type: 'executive',
    price: 120000,
    capacity: 3,
    status: 'available'
  }
];

export async function seedRoomsIfEmpty() {
  try {
    const querySnapshot = await getDocs(collection(db, 'rooms'));
    if (querySnapshot.empty) {
      console.log('Seeding initial rooms...');
      for (const room of initialRooms) {
        await addDoc(collection(db, 'rooms'), room);
      }
      console.log('Rooms seeded successfully.');
    }
  } catch (error) {
    console.error('Error seeding rooms:', error);
  }
}
