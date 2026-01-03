# 🚀 Production Deployment Guide

## Prerequisites

- [ ] PostgreSQL database (managed service recommended)
- [ ] Node.js 18+ installed on server
- [ ] Domain name configured
- [ ] SSL certificate (Let's Encrypt recommended)
- [ ] Google OAuth credentials for production domain

---

## 🔒 Security Checklist Before Deploy

- [ ] Change all default secrets and passwords
- [ ] Use strong JWT_SECRET (minimum 32 random characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure proper CORS origins
- [ ] Set secure cookie flags (if using cookies)
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Use environment variables (never hardcode secrets)
- [ ] Enable database connection pooling
- [ ] Set up monitoring and logging

---

## 📝 Environment Variables Setup

### Production Backend (.env)

```env
# Database - Use managed PostgreSQL service
DATABASE_URL="postgresql://user:password@your-db-host:5432/rescue_me_prod?schema=public&sslmode=require"

# JWT - Generate strong random secret
JWT_SECRET="<generate-with: openssl rand -base64 32>"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Google OAuth - Production credentials
GOOGLE_CLIENT_ID="your-production-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-production-client-secret"
GOOGLE_CALLBACK_URL="https://api.yourdomain.com/api/auth/google/callback"

# URLs
FRONTEND_URL="https://yourdomain.com"

# Server
PORT=3001
NODE_ENV="production"

# Optional: Logging
LOG_LEVEL="info"
```

### Production Frontend (.env.production.local)

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-production-client-id.apps.googleusercontent.com
```

---

## 🗄️ Database Setup

### 1. Create Production Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE rescue_me_prod;

# Create user
CREATE USER rescue_user WITH PASSWORD 'strong-password-here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE rescue_me_prod TO rescue_user;
```

### 2. Run Migrations

```bash
cd backend

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

### 3. Database Backups

Set up automated daily backups:

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
pg_dump -U rescue_user rescue_me_prod > $BACKUP_DIR/backup_$DATE.sql
```

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

---

## 🔧 Backend Deployment

### Option 1: PM2 (Recommended for VPS)

```bash
# Install PM2 globally
npm install -g pm2

# Build backend
cd backend
npm run build

# Start with PM2
pm2 start dist/main.js --name rescue-backend

# Configure auto-restart on server reboot
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs rescue-backend
```

### PM2 Ecosystem File (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'rescue-backend',
    script: './dist/main.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};

// Usage: pm2 start ecosystem.config.js
```

### Option 2: Docker

**Dockerfile (backend)**:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma Client
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Start
CMD ["node", "dist/main.js"]
```

**Build and run**:
```bash
# Build
docker build -t rescue-backend .

# Run
docker run -d \
  --name rescue-backend \
  -p 3001:3001 \
  --env-file .env \
  rescue-backend
```

---

## 🎨 Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**:
```bash
npm i -g vercel
```

2. **Deploy**:
```bash
cd frontend
vercel --prod
```

3. **Environment Variables**:
- Go to Vercel Dashboard
- Project Settings → Environment Variables
- Add production variables

### Option 2: Self-hosted with PM2

```bash
cd frontend

# Build
npm run build

# Start with PM2
pm2 start npm --name "rescue-frontend" -- start

# Save configuration
pm2 save
```

### Option 3: Docker

**Dockerfile (frontend)**:
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build
ENV NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "start"]
```

---

## 🌐 Nginx Configuration

### Backend Reverse Proxy

```nginx
# /etc/nginx/sites-available/rescue-backend
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Frontend Configuration

```nginx
# /etc/nginx/sites-available/rescue-frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable sites**:
```bash
sudo ln -s /etc/nginx/sites-available/rescue-backend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/rescue-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔐 SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get certificates
sudo certbot --nginx -d api.yourdomain.com
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

---

## 🎯 Google OAuth Production Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new OAuth credentials or update existing
3. **Authorized JavaScript origins**:
   - `https://yourdomain.com`
4. **Authorized redirect URIs**:
   - `https://api.yourdomain.com/api/auth/google/callback`
   - `https://yourdomain.com`
5. Copy Client ID and Client Secret to production .env files

---

## 📊 Monitoring & Logging

### Application Monitoring with PM2

```bash
# Monitor in real-time
pm2 monit

# View logs
pm2 logs rescue-backend --lines 100

# Metrics
pm2 web
# Access at http://localhost:9615
```

### Log Rotation

```bash
# Install PM2 log rotate
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### Health Checks

Create health check endpoint:

**backend/src/health/health.controller.ts**:
```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    // Check database connection
    await this.prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
```

Monitor with:
```bash
curl https://api.yourdomain.com/health
```

---

## 🔄 Deployment Process

### 1. Pre-deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates valid
- [ ] Backups taken

### 2. Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Backend deployment
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart rescue-backend

# 3. Frontend deployment
cd ../frontend
npm install
npm run build
pm2 restart rescue-frontend

# 4. Verify
curl https://api.yourdomain.com/health
curl https://yourdomain.com
```

### 3. Rollback Plan

```bash
# If deployment fails, rollback:
git checkout previous-working-commit
pm2 restart all
```

---

## 🚨 Common Production Issues

### Issue: Database connection pool exhausted
**Solution**: Increase connection pool size in Prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Add connection pool
  pool_max = 10
  pool_min = 2
  pool_timeout = 30
}
```

### Issue: Memory leaks
**Solution**: Use PM2 max memory restart

```bash
pm2 start app.js --max-memory-restart 1G
```

### Issue: High CPU usage
**Solution**: Use cluster mode

```bash
pm2 start app.js -i max
```

---

## 📈 Performance Optimization

### 1. Enable Compression

```typescript
// main.ts
import compression from 'compression';

app.use(compression());
```

### 2. Database Indexing

Already configured in schema.prisma:
```prisma
@@index([email])
@@index([googleId])
```

### 3. Caching (Optional)

Install Redis for session caching:
```bash
npm install @nestjs/cache-manager cache-manager
```

---

## 🔒 Security Best Practices

1. **Rate Limiting**:
```typescript
import { rateLimit } from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

2. **Helmet for Security Headers**:
```bash
npm install helmet
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

3. **Database Connection Security**:
- Always use SSL/TLS for database connections
- Use connection pooling
- Never expose database directly to internet

---

## 📞 Monitoring & Alerts

### Setup Email Alerts (PM2)

```bash
pm2 install pm2-auto-pull

# Configure alerts
pm2 set pm2-auto-pull:interval 300
```

### Log Monitoring

Use services like:
- **Sentry** for error tracking
- **LogRocket** for user sessions
- **DataDog** for infrastructure monitoring

---

## ✅ Post-Deployment Checklist

- [ ] All services running (pm2 status)
- [ ] SSL certificates valid
- [ ] Health endpoint responding
- [ ] Database migrations applied
- [ ] Logs being written
- [ ] Monitoring active
- [ ] Backups scheduled
- [ ] DNS configured correctly
- [ ] Email notifications working
- [ ] Test all authentication flows

---

## 📝 Maintenance Schedule

**Daily**:
- Check logs for errors
- Monitor server resources

**Weekly**:
- Review security alerts
- Check backup integrity
- Update dependencies (minor versions)

**Monthly**:
- Database optimization (VACUUM, ANALYZE)
- Review and rotate logs
- Security audit
- Update SSL certificates if needed

---

## 🆘 Emergency Procedures

### Database Restore

```bash
# Stop application
pm2 stop all

# Restore from backup
psql -U rescue_user rescue_me_prod < backup_file.sql

# Restart application
pm2 start all
```

### Complete System Recovery

```bash
# 1. Restore database
# 2. Pull last working commit
git checkout last-known-good-commit

# 3. Rebuild and restart
cd backend && npm run build && pm2 restart rescue-backend
cd frontend && npm run build && pm2 restart rescue-frontend
```

---

## 📚 Additional Resources

- [NestJS Production Deployment](https://docs.nestjs.com/faq/serverless)
- [Next.js Production Checklist](https://nextjs.org/docs/deployment)
- [PM2 Documentation](https://pm2.keymetrics.io/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Nginx Best Practices](https://nginx.org/en/docs/)

---

**Remember**: Always test in staging environment before deploying to production!

Good luck with your deployment! 🚀
