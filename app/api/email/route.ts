import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { BookingEmailTemplate } from '@/components/booking/BookingEmailTemplate';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { 
      customerName, 
      customerEmail, 
      roomName, 
      checkIn, 
      checkOut, 
      bookingId, 
      totalAmount 
    } = await req.json();

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not set. Mocking email sending.');
      return NextResponse.json({ 
        message: 'Email sending mocked (API key missing)',
        success: true
      });
    }

    const data = await resend.emails.send({
      from: 'Serene Resort <bookings@resend.dev>', // resend.dev is the default test domain
      to: [customerEmail],
      subject: `Booking Confirmation: ${roomName} at Serene Resort`,
      react: BookingEmailTemplate({
        customerName,
        roomName,
        checkIn,
        checkOut,
        bookingId,
        totalAmount
      }),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to send email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
