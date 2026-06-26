import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface BookingEmailTemplateProps {
  customerName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  bookingId: string;
  totalAmount: number;
}

export const BookingEmailTemplate = ({
  customerName,
  roomName,
  checkIn,
  checkOut,
  bookingId,
  totalAmount,
}: BookingEmailTemplateProps) => (
  <Html>
    <Head />
    <Preview>Your Booking Confirmation at Serene Resort</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={heading}>Booking Confirmed!</Heading>
          <Text style={subheading}>Thank you for choosing Serene Resort</Text>
        </Section>
        
        <Section style={content}>
          <Text style={text}>Hi {customerName},</Text>
          <Text style={text}>
            We&apos;re thrilled to confirm your reservation. Below are the details of your upcoming stay.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>Reservation Details</Text>
            <Text style={cardText}><strong>Booking ID:</strong> {bookingId}</Text>
            <Text style={cardText}><strong>Room:</strong> {roomName}</Text>
            <Text style={cardText}><strong>Check-in:</strong> {checkIn}</Text>
            <Text style={cardText}><strong>Check-out:</strong> {checkOut}</Text>
            <Text style={cardText}><strong>Total Amount:</strong> ₦{totalAmount.toLocaleString()}</Text>
          </Section>

          <Text style={text}>
            If you have any questions or need to make changes to your reservation, please don&apos;t hesitate to contact our support team.
          </Text>
          
          <Hr style={hr} />
          
          <Text style={footer}>
            Serene Resort<br />
            123 Paradise Lane, Coastal City<br />
            +234 800 000 0000 | support@sereneresort.com
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  overflow: 'hidden',
};

const header = {
  backgroundColor: '#f59e0b', // Amber 500
  padding: '32px 48px',
  textAlign: 'center' as const,
};

const heading = {
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0',
};

const subheading = {
  color: '#fef3c7', // Amber 100
  fontSize: '16px',
  margin: '8px 0 0',
};

const content = {
  padding: '48px',
};

const text = {
  color: '#334155', // Slate 700
  fontSize: '16px',
  lineHeight: '26px',
};

const card = {
  backgroundColor: '#f8fafc', // Slate 50
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  border: '1px solid #e2e8f0', // Slate 200
};

const cardTitle = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#0f172a', // Slate 900
  margin: '0 0 16px',
};

const cardText = {
  color: '#475569', // Slate 600
  fontSize: '15px',
  margin: '8px 0',
};

const hr = {
  borderColor: '#e2e8f0', // Slate 200
  margin: '32px 0',
};

const footer = {
  color: '#94a3b8', // Slate 400
  fontSize: '14px',
  lineHeight: '22px',
  textAlign: 'center' as const,
};
