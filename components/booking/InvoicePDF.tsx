'use client';

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Register fonts (optional, but good for pro look)
// Using standard fonts for now to avoid loading issues in this environment
// Font.register({
//   family: 'Playfair Display',
//   src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD7K83om0nz31owiC6QC9mw.ttf'
// });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155', // slate-700
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    borderBottom: 1,
    borderBottomColor: '#E2E8F0', // slate-200
    paddingBottom: 20,
  },
  logoSection: {
    flexDirection: 'column',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A', // slate-900
  },
  logoSubtext: {
    fontSize: 10,
    color: '#F59E0B', // amber-500
    marginTop: 2,
    letterSpacing: 1,
  },
  invoiceInfo: {
    textAlign: 'right',
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 4,
  },
  badge: {
    padding: '4 8',
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 4,
  },
  paidBadge: {
    backgroundColor: '#DCFCE7', // green-100
    color: '#166534', // green-800
  },
  unpaidBadge: {
    backgroundColor: '#FEF3C7', // amber-100
    color: '#92400E', // amber-800
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    marginBottom: 10,
  },
  label: {
    fontSize: 8,
    color: '#64748B', // slate-500
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    fontWeight: 'medium',
    color: '#1E293B', // slate-800
  },
  table: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC', // slate-50
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    padding: 10,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  col1: { width: '60%' },
  col2: { width: '20%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  totalSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalBox: {
    width: '40%',
    padding: 15,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTop: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 8,
    color: '#94A3B8',
    marginBottom: 4,
  },
});

interface InvoiceProps {
  booking: {
    id: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    roomName: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalAmount: number;
    createdAt: string;
    paymentStatus: string;
    paymentMethod: string;
  };
}

export const InvoicePDF = ({ booking }: InvoiceProps) => {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const isPaid = booking.paymentStatus === 'paid';
  const isPayAtHotel = booking.paymentMethod === 'pay_at_hotel';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Text style={styles.logoText}>Noktel Resort</Text>
            <Text style={styles.logoSubtext}>LUXURY ACCOMMODATION</Text>
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceTitle}>{isPaid ? 'INVOICE' : 'RESERVATION VOUCHER'}</Text>
            <Text style={styles.value}>#{booking.id.slice(-8).toUpperCase()}</Text>
            <View style={[styles.badge, isPaid ? styles.paidBadge : styles.unpaidBadge]}>
              <Text>{isPaid ? 'PAID' : 'PAYMENT DUE AT PROPERTY'}</Text>
            </View>
            <Text style={[styles.label, { marginTop: 8 }]}>Date: {formatDate(booking.createdAt)}</Text>
          </View>
        </View>

        {/* Guest & Stay Info */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.sectionTitle}>Guest Details</Text>
            <Text style={styles.value}>{booking.customerName}</Text>
            <Text style={styles.value}>{booking.customerEmail}</Text>
            <Text style={styles.value}>{booking.customerPhone}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.sectionTitle}>Resort Address</Text>
            <Text style={styles.value}>Noktel Resort Hotel</Text>
            <Text style={styles.value}>No. 1 Noktel Drive, Off G.R.A</Text>
            <Text style={styles.value}>Ilorin, Kwara State, Nigeria</Text>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Stay Information</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Check-In</Text>
              <Text style={styles.value}>{formatDate(booking.checkIn)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Check-Out</Text>
              <Text style={styles.value}>{formatDate(booking.checkOut)}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Room Type</Text>
              <Text style={styles.value}>{booking.roomName}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.label}>Guests</Text>
              <Text style={styles.value}>{booking.guests} Adult(s)</Text>
            </View>
          </View>
        </View>

        {/* Charges Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, styles.label]}>Description</Text>
            <Text style={[styles.col2, styles.label]}>Qty</Text>
            <Text style={[styles.col3, styles.label]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.col1}>Accommodation: {booking.roomName}</Text>
            <Text style={styles.col2}>1</Text>
            <Text style={styles.col3}>NGN {booking.totalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.col1}>Service Charge & VAT</Text>
            <Text style={styles.col2}>-</Text>
            <Text style={styles.col3}>Included</Text>
          </View>
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{isPaid ? 'Total Amount Paid' : 'Total Amount Due'}</Text>
            <Text style={styles.totalValue}>NGN {booking.totalAmount.toLocaleString()}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for choosing Noktel Resort Hotel.</Text>
          {!isPaid && (
            <Text style={[styles.footerText, { fontWeight: 'bold', color: '#0F172A' }]}>
              Please present this voucher at the front desk upon arrival to complete your payment.
            </Text>
          )}
          <Text style={styles.footerText}>This is a computer-generated document and does not require a physical signature.</Text>
          <Text style={[styles.footerText, { marginTop: 10, color: '#F59E0B' }]}>www.noktelresort.com | +234 800 NOKTEL</Text>
        </View>
      </Page>
    </Document>
  );
};
