# Noktel Resort Booking & AI Voice System

A premium, full-stack hotel management and booking application designed for **Noktel Resort Hotel, Ilorin**. This system combines a modern web booking experience with cutting-edge AI-powered automated call handling.



## 🌟 Key Features

### 🏨 Guest Experience
- **Real-time Booking:** Seamless room selection and reservation flow.
- **AI Voice Assistant:** Integrated AI voice handling for automated booking inquiries and reservations.
- **Premium UI/UX:** High-performance, responsive design with smooth cinematic transitions and glassmorphism elements.
- **Dynamic Content:** Real-time updates for room availability and pricing.

### 🛠 Admin Management
- **Comprehensive Dashboard:** Manage all hotel operations from a single interface.
- **Room Management:** Create, edit, and delete rooms with real-time status updates (Available/Maintenance).
- **Booking Tracking:** Monitor all incoming reservations from web and phone sources.
- **Website Customization:** Dynamic control over hero images and section content across the entire site.
- **Secure Access:** Role-based access control (RBAC) powered by Firebase Authentication.

## 🚀 Tech Stack

- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Database & Auth:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Storage)
- **AI Engine:** [Google Gemini API](https://ai.google.dev/)
- **Icons:** [Lucide React](https://lucide.dev/)

## 📂 Project Structure

```text
├── app/                  # Next.js App Router (Pages & API)
├── components/           # Reusable UI components
│   ├── admin/            # Admin Dashboard components
│   ├── booking/          # Booking flow and modal logic
│   ├── home/             # Homepage sections (Hero, Showcase, etc.)
│   ├── layout/           # Navigation and Footer
│   └── ui/               # Base UI components (shadcn/ui)
├── hooks/                # Custom React hooks (useRooms, useSettings, etc.)
├── lib/                  # Utility functions and Firebase config
├── public/               # Static assets
└── firestore.rules       # Firebase Security Rules
```

## 🛠 Getting Started

### Prerequisites
- Node.js 20+
- Firebase Project
- Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd noktel-resort
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   provide the following environment variables:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 🔒 Security

The project implements strict **Firebase Security Rules** to ensure data integrity:
- **Default Deny:** All access is restricted by default.
- **RBAC:** Only verified administrators can modify rooms or site settings.
- **Data Validation:** Comprehensive schema validation for all Firestore writes.
- **PII Protection:** Guest information is strictly scoped to authorized staff and the document owner.

## 📄 License

This project is private and proprietary. All rights reserved.

---

Built with ❤️.
