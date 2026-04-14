import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BookingProvider } from '@/components/booking/BookingContext';
import { AIVoiceAssistant } from '@/components/booking/AIVoiceAssistant';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'Noktel Resort Hotel | Luxury in Ilorin',
  description: 'Experience unmatched luxury and comfort at Noktel Resort Hotel, Ilorin. Book your stay online or use our automated voice assistant.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} scroll-smooth`}>
      <body className="font-sans antialiased text-slate-900 bg-white" suppressHydrationWarning>
        <ErrorBoundary>
          <BookingProvider>
            <Navbar />
            <main className="min-h-screen">
              {children}
            </main>
            <Footer />
            <AIVoiceAssistant />
          </BookingProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
