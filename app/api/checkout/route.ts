import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_1234567890');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bookingData, successUrl, cancelUrl } = body;

    console.log('Creating Stripe Checkout Session for:', bookingData.customerEmail);

    if (!bookingData || !bookingData.totalAmount) {
      console.error('Validation Error: Missing booking data or amount');
      return NextResponse.json({ error: 'Missing booking data or amount' }, { status: 400 });
    }

    // Create Checkout Sessions from body params.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'ngn',
            product_data: {
              name: `Booking: ${bookingData.roomName}`,
              description: `${bookingData.checkIn} to ${bookingData.checkOut} (${bookingData.guests} guests)`,
            },
            unit_amount: Math.round(bookingData.totalAmount * 100), // Ensure it's an integer
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: bookingData.customerEmail,
      metadata: {
        roomId: bookingData.roomId,
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
      },
    });

    console.log('Stripe Session Created:', session.id);
    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error('Stripe Error:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
