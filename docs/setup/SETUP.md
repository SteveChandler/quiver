# Quiver Surf App - Setup Guide

## 🚀 Quick Setup (New Environment)

For moving this project to a new machine or environment:

```bash
# 1. Clone/copy the project
git clone <repository-url>
cd quiver

# 2. Install all dependencies (Node.js 18+ required)
yarn install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run database migrations (if needed)
# Connect to your Supabase project and run migrations from scripts/migrations/

# 5. Start development server
yarn dev
```

## 📦 Project Dependencies

### Core Framework

- **Next.js 14.2.29** - React framework with app router
- **React 18.2.0** - UI library
- **TypeScript 5** - Type safety

### Database & Backend

- **@supabase/supabase-js** - Database client
- **@supabase/ssr** - Server-side rendering support

### UI Components

- **@radix-ui/react-\*** - Headless UI components
- **lucide-react** - Icon library
- **framer-motion** - Animations
- **tailwindcss** - Styling framework
- **class-variance-authority** - Component variants
- **clsx** & **tailwind-merge** - Class utilities

### Forms & Validation

- **react-hook-form** - Form management
- **@hookform/resolvers** - Form validation
- **zod** - Schema validation

### Data & Utilities

- **date-fns** - Date utilities
- **lodash** - Utility functions
- **uuid** - Unique ID generation

### Maps & Visualization

- **leaflet** - Map library
- **mapbox-gl** - Mapbox integration
- **recharts** - Charts and graphs

### Testing

- **jest** - Unit testing
- **@testing-library/react** - Component testing
- **@playwright/test** - E2E testing

## 🛠 Available Scripts

### Development

```bash
yarn dev             # Start development server
yarn build           # Build for production
yarn start           # Start production server
yarn lint            # Run ESLint
```

### Testing

```bash
yarn test            # Run unit tests
yarn test:watch      # Run tests in watch mode
yarn test:e2e        # Run E2E tests
yarn test:e2e:ui     # Run E2E tests with UI
```

### Data Management

```bash
yarn buoy:sync               # Sync NOAA buoy data
yarn buoy:update-conditions  # Update buoy conditions
yarn forecast:update         # Update surf forecasts
yarn update:all              # Update all data sources
yarn cleanup:old             # Clean up old data
```

### Database

```bash
yarn db:health       # Check database health
yarn fix:srid        # Apply SRID fixes if needed
```

## 🔧 Environment Variables Required

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Analytics & Monitoring
NEXT_PUBLIC_VERCEL_URL=your_deployment_url
```

## 🗃 Database Setup

1. **Create Supabase Project**: Visit [supabase.com](https://supabase.com)
2. **Run Migrations**: Execute SQL files in `scripts/migrations/` in order
3. **Enable Extensions**: PostGIS, UUID, etc.
4. **Set up RLS**: Row Level Security policies are included in migrations

## 📱 Development Workflow

### For New Features

1. Create feature branch
2. Run tests: `yarn test`
3. Test E2E flows: `yarn test:e2e`
4. Build check: `yarn build`
5. Deploy to staging

### For Database Changes

1. Create migration file in `scripts/migrations/`
2. Test locally
3. Apply to staging
4. Apply to production

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Connect to Vercel
vercel

# Set environment variables in Vercel dashboard
# Deploy
vercel --prod
```

### Manual Deployment

```bash
yarn build
yarn start
```

## 🔍 Troubleshooting

### Common Issues

**Dependencies not installing:**

```bash
rm -rf node_modules yarn.lock
yarn install
```

**TypeScript errors:**

```bash
yarn build     # Check for type errors
```

**Database connection issues:**

- Verify `.env.local` credentials
- Check Supabase project status
- Run `yarn db:health`

**Build failures:**

- Check Node.js version (18+ required)
- Clear Next.js cache: `rm -rf .next`
- Rebuild: `yarn build`

## 📚 Project Structure

```
quiver/
├── app/                 # Next.js app router pages
├── components/          # React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and services
├── scripts/            # Database and data management
├── __tests__/          # Unit and integration tests
├── e2e/                # End-to-end tests
└── docs/               # Documentation
```

## 🤝 Contributing

1. Follow the established patterns in `docs/ARCHITECTURE.md`
2. Use the DRY components documented in `docs/STYLE_GUIDE.md` (DRY Component Patterns section)
3. Write tests for new features
4. Update documentation as needed

## 🆘 Support

- **Architecture**: See `docs/ARCHITECTURE.md`
- **Component Usage**: See `docs/STYLE_GUIDE.md` (DRY Component Patterns section)
- **API Documentation**: See individual endpoint files
- **Database Schema**: See `scripts/migrations/`
