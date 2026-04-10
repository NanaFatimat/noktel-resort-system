import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe with a test key if the environment variable is missing
// This ensures the app doesn't crash during development/testing
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_1234567890', {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bookingData, successUrl, cancelUrl } = body;

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
            unit_amount: bookingData.totalAmount * 100, // Stripe expects amounts in kobo/cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        // We can pass metadata to retrieve later via webhooks if needed
        roomId: bookingData.roomId,
        customerName: bookingData.customerName,
        customerEmail: bookingData.customerEmail,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error('Stripe Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
