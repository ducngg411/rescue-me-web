# 🚑 Rescue Me - Emergency Rescue Platform

A comprehensive emergency rescue service platform with enterprise-grade authentication and onboarding system.

## 🎯 Overview

Rescue Me is a full-stack web application built with modern technologies, featuring:

- ✅ Secure authentication (Email/Password + Google OAuth)
- ✅ User onboarding with mandatory profile completion
- ✅ JWT-based session management
- ✅ Protected routes and role-based access
- ✅ PostgreSQL database with Prisma ORM
- ✅ Modern UI with Next.js 16 and Tailwind CSS

## 🛠️ Tech Stack

### Backend
- **Framework**: NestJS 11
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Authentication**: Passport.js + JWT
- **OAuth**: Google OAuth 2.0
- **Validation**: class-validator
- **Security**: bcrypt, helmet

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form
- **OAuth**: @react-oauth/google
- **HTTP Client**: Axios

## 📁 Project Structure

```
rescue-me-web/
├── backend/              # NestJS backend application
│   ├── src/
│   │   ├── auth/        # Authentication module
│   │   ├── prisma/      # Prisma service
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
├── frontend/            # Next.js frontend application
│   ├── app/
│   │   ├── auth/       # Authentication pages
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── contexts/       # React contexts
│   ├── lib/            # Utilities and API client
│   └── package.json
│
└── docs/               # Documentation
    ├── README_AUTH.md
    ├── API_DOCUMENTATION.md
    ├── FLOW_DIAGRAMS.md
    └── DEPLOYMENT_GUIDE.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- npm or yarn
- Google OAuth credentials (for OAuth login)

### Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd rescue-me-web
```

2. **Run setup script**:
```bash
# On Windows
setup.bat

# On Linux/Mac
chmod +x setup.sh
./setup.sh
```

Or manually:

3. **Backend setup**:
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npx prisma generate
npx prisma migrate dev --name init
```

4. **Frontend setup**:
```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

### Development

Start both servers in separate terminals:

**Terminal 1 - Backend**:
```bash
cd backend
npm run start:dev
# Backend runs on http://localhost:3001
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

Visit http://localhost:3000 to see the application.

## 🔐 Authentication Features

### Supported Login Methods

1. **Email/Password**
   - Secure registration with password strength validation
   - Password hashing with bcrypt
   - Email format validation

2. **Google OAuth**
   - One-click sign-in/sign-up
   - Automatic profile creation
   - Avatar synchronization

### Security Features

- ✅ Password strength enforcement (min 8 chars, uppercase, numbers)
- ✅ JWT tokens with 7-day expiration
- ✅ Refresh tokens with 30-day expiration
- ✅ Google ID Token verification
- ✅ Session tracking in database
- ✅ Protected routes with authentication guards
- ✅ CORS protection
- ✅ Input validation on all endpoints

### User Flow

1. **New User Registration**
   - Register with email/password or Google
   - Automatic redirect to profile completion
   - Must complete profile before accessing app

2. **Returning User Login**
   - Login with credentials or Google
   - Check profile completion status
   - Redirect to app if profile complete

3. **Profile Completion**
   - Required fields: name, phone, address, emergency contact
   - One-time mandatory step
   - Unlocks full app access

## 📚 Documentation

- **[Authentication Guide](README_AUTH.md)** - Complete authentication system documentation
- **[API Documentation](API_DOCUMENTATION.md)** - Detailed API reference
- **[Flow Diagrams](FLOW_DIAGRAMS.md)** - Visual flow charts
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Quick reference

## 🌐 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register/email` | Email registration | No |
| POST | `/api/auth/login/email` | Email login | No |
| POST | `/api/auth/login/google` | Google OAuth login | No |
| POST | `/api/auth/profile/complete` | Complete user profile | Yes |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/logout` | Logout | Yes |

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full details.

## 🗄️ Database Schema

### User Model
```prisma
model User {
  id               String       @id @default(cuid())
  email            String       @unique
  name             String?
  avatar           String?
  authProvider     AuthProvider
  hashedPassword   String?
  googleId         String?      @unique
  profileCompleted Boolean      @default(false)
  phone            String?
  address          String?
  emergencyContact String?
  role             UserRole     @default(USER)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  lastLogin        DateTime?
  sessions         Session[]
}
```

See [README_AUTH.md](README_AUTH.md) for complete schema.

## 🧪 Testing

### Manual Testing Scenarios

1. **Email Registration Flow**
   - Visit `/auth/register`
   - Test password strength indicator
   - Complete profile after registration

2. **Google OAuth Flow**
   - Test new user creation
   - Test returning user login
   - Verify profile completion redirect

3. **Protected Routes**
   - Access home page without login
   - Should redirect to login
   - Login and verify access

4. **Error Scenarios**
   - Duplicate email registration
   - Wrong password
   - Wrong auth provider
   - Expired token

## 🔧 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/rescue_me_db"
JWT_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
FRONTEND_URL="http://localhost:3000"
PORT=3001
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Error**
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Run `npx prisma migrate dev`

**CORS Error**
- Verify FRONTEND_URL in backend .env
- Check frontend URL matches

**Google OAuth Not Working**
- Verify GOOGLE_CLIENT_ID in both apps
- Check authorized origins in Google Console

**Token Invalid**
- Clear browser localStorage
- Re-login to get new token

See [README_AUTH.md](README_AUTH.md#common-issues--solutions) for more.

## 📦 Available Scripts

### Backend
```bash
npm run start:dev    # Development mode with hot reload
npm run build        # Build for production
npm run start:prod   # Start production build
npm run lint         # Lint code
```

### Frontend
```bash
npm run dev          # Development mode
npm run build        # Build for production
npm run start        # Start production build
npm run lint         # Lint code
```

## 🚢 Deployment

For production deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

Quick overview:
1. Setup production database
2. Configure environment variables
3. Run database migrations
4. Build applications
5. Deploy with PM2, Docker, or cloud services
6. Configure Nginx reverse proxy
7. Setup SSL certificates

## 🔒 Security Considerations

- Never commit `.env` files
- Use strong JWT secrets in production
- Enable HTTPS in production
- Implement rate limiting
- Regular security audits
- Keep dependencies updated
- Use environment-specific credentials
- Enable database SSL connections

## 🎯 Roadmap

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Two-factor authentication (2FA)
- [ ] Social login (Facebook, Apple)
- [ ] User profile editing
- [ ] Role-based access control
- [ ] Admin dashboard
- [ ] Audit logs
- [ ] Real-time notifications

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and confidential.

## 🆘 Support

For issues and questions:
- Check [README_AUTH.md](README_AUTH.md) for detailed documentation
- Review [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API reference
- See [Flow Diagrams](FLOW_DIAGRAMS.md) for visual guides

## 🙏 Acknowledgments

- NestJS team for the amazing framework
- Next.js team for the excellent React framework
- Prisma team for the powerful ORM
- All open-source contributors

---

**Built with ❤️ for emergency rescue services**
