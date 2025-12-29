# RescueMe - Emergency Assistance Platform

A Next.js application for connecting users with emergency service providers.

## Project Structure

```
rescueme/
├── app/                        # Next.js App Router
│   ├── (public)/              # Public pages
│   ├── (auth)/                # Authentication pages
│   ├── (user)/                # User dashboard
│   ├── (provider)/            # Provider dashboard
│   └── api/                   # API routes
├── components/                 # React components
│   ├── ui/                    # shadcn/ui components
│   ├── shared/                # Shared components
│   ├── auth/                  # Auth components
│   ├── map/                   # Map components
│   └── request/               # Request components
├── features/                   # Domain modules
│   ├── auth/                  # Authentication feature
│   ├── user/                  # User feature
│   ├── provider/              # Provider feature
│   └── request/               # Request feature
├── lib/                       # Libraries and utilities
│   ├── firebase/              # Firebase integration
│   └── vietmap/               # VietMap integration
├── schemas/                   # Validation schemas
├── hooks/                     # Custom React hooks
├── contexts/                  # React contexts
├── providers/                 # App providers
├── types/                     # TypeScript types
└── constants/                 # App constants
```

## Features

- Firebase Authentication
- VietMap Integration
- User & Provider Roles
- Real-time Location Tracking
- Payment Integration (SePay)
- Responsive Design

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Authentication:** Firebase Auth
- **Database:** Cloud Firestore
- **Maps:** VietMap
- **Validation:** Zod
- **State Management:** React Context

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT

