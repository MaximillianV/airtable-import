# Airtable Import Application

A full-stack Node.js/React application for importing Airtable bases into PostgreSQL databases. The application includes a Node.js/Express backend with authentication and real-time import progress, and a React TypeScript frontend with user login and settings management.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Dependencies and Setup
- Install Node.js dependencies:
  - Backend: `cd backend && npm install` -- takes 5 seconds. NEVER CANCEL.
  - Frontend: `cd frontend && npm install` -- takes 12 seconds. NEVER CANCEL.
- Both installations complete successfully with some deprecation warnings (normal).

### Build and Test Commands
- Backend tests: `cd backend && npm test` -- takes 2 seconds. NEVER CANCEL. Runs 19 tests successfully.
- Frontend tests: `cd frontend && CI=true npm test -- --coverage --watchAll=false` -- takes 4 seconds. NEVER CANCEL.
- Frontend build: `cd frontend && npm run build` -- takes 12 seconds. NEVER CANCEL. Creates optimized production build.
- ALWAYS run tests after making code changes to ensure no regressions.

### Application Startup
- **RECOMMENDED**: Full stack startup: `./start-all.sh install` -- backend ready in 15 seconds, frontend ready in 45 seconds total. NEVER CANCEL.
- **Alternative manual startup**:
  - Backend: `cd backend && npm run start:safe` or `cd backend && npm run dev:safe` (for development)
  - Frontend: `cd frontend && npm run start:safe`
- The startup scripts automatically:
  - Clean up any processes using development ports (3000, 3001, 3002, 8001, 8080)
  - Create environment files with sensible defaults
  - Handle proper port management across different machines

### Environment Configuration
- Backend automatically creates `.env` file from `.env.example` with defaults:
  ```env
  PORT=3001
  NODE_ENV=development
  JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
  ADMIN_EMAIL=admin@example.com
  ADMIN_PASSWORD=admin123
  DATABASE_URL=sqlite::memory:
  ```
- Frontend automatically creates `.env.local` file with defaults:
  ```env
  REACT_APP_API_URL=http://localhost:3001/api
  REACT_APP_SOCKET_URL=http://localhost:3001
  ```

## Validation

### Always Test These Scenarios After Making Changes
- **Backend Health Check**: `curl -f http://localhost:3001/api/health` - should return `{"status":"OK","timestamp":"..."}`
- **Authentication Flow**: Test login with default credentials:
  ```bash
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"admin123"}'
  ```
  Should return JWT token and user object.
- **Frontend Loading**: `curl -f http://localhost:3000` - should return React HTML page.
- **Full Integration**: Start both services and verify both endpoints respond correctly.

### Manual Testing Requirements
- ALWAYS test the complete user flow: login → dashboard → settings → import process
- Verify real-time updates work by testing Socket.IO connections
- Test error handling with invalid credentials
- Validate environment variable fallbacks work correctly

### CI/CD Validation
- The `.github/workflows/ci-cd.yml` runs comprehensive tests including:
  - Backend unit tests with Jest
  - Frontend tests with React Testing Library
  - Integration tests with PostgreSQL
  - Full application startup validation
- ALWAYS ensure your changes pass local testing before committing

## Architecture and Navigation

### Key Directories
```
├── backend/               # Node.js/Express backend
│   ├── src/
│   │   ├── routes/       # API routes (auth.js, settings.js, import.js)
│   │   ├── middleware/   # Authentication middleware
│   │   └── services/     # Business logic (database.js, airtable.js, import.js)
│   ├── tests/            # Jest unit tests (auth.test.js, database.test.js)
│   ├── start-server.sh   # Safe backend startup script
│   └── package.json      # Backend dependencies and scripts
├── frontend/             # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components (Login.tsx, Dashboard.tsx, Import.tsx, etc.)
│   │   ├── contexts/     # AuthContext.tsx for state management
│   │   ├── services/     # API and Socket.IO services
│   │   └── types/        # TypeScript type definitions
│   ├── start-frontend.sh # Safe frontend startup script
│   └── package.json      # Frontend dependencies and scripts
├── start-all.sh         # Full stack startup script
└── .github/workflows/   # CI/CD configuration
```

### API Endpoints
- `GET /api/health` - Health check endpoint
- `POST /api/auth/login` - User authentication (use admin@example.com / admin123)
- `POST /api/auth/register` - User registration
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Save user settings
- `POST /api/import/start` - Start Airtable import process

### Default Credentials
- **Email**: admin@example.com
- **Password**: admin123

## Common Tasks

### Port Management
- The startup scripts automatically handle port cleanup using `lsof`
- Manual port cleanup if needed:
  ```bash
  # Kill processes on specific ports
  lsof -ti:3001 | xargs kill -9 || true
  lsof -ti:3000 | xargs kill -9 || true
  ```

### Database Configuration
- **Development/Testing**: Uses SQLite in-memory database (no setup required)
- **Production**: Requires PostgreSQL with connection string format:
  `postgresql://username:password@localhost:5432/database_name`

### Troubleshooting
- **JWT Secret Errors**: Application provides fallback secrets for development
- **Port Conflicts**: Startup scripts automatically handle cleanup
- **Build Failures**: Run `npm install` in the affected directory
- **Test Failures**: Check if environment variables are set correctly

### Before Committing Changes
- ALWAYS run the full test suite: `cd backend && npm test && cd ../frontend && CI=true npm test -- --watchAll=false`
- Test application startup: `./start-all.sh install`
- Verify API endpoints work correctly
- Test the authentication flow manually
- Ensure all new features work in both development and test environments

## Development Workflow
1. Start development environment: `./start-all.sh install`
2. Make your changes to backend or frontend code
3. Tests run automatically during development (nodemon for backend, hot reload for frontend)
4. Validate changes with manual testing scenarios
5. Run full test suite before committing
6. Use provided startup scripts to ensure consistent environment setup

## Technology Stack
- **Backend**: Node.js 16+, Express 5.x, JWT authentication, Socket.IO for real-time updates
- **Frontend**: React 19.x, TypeScript 4.x, React Router 6.x, Axios for API calls
- **Database**: SQLite (development/testing), PostgreSQL (production)
- **Testing**: Jest (backend), React Testing Library (frontend)
- **Build Tools**: React Scripts 5.x for frontend bundling