# Airtable Import

A full-stack application for importing Airtable bases into PostgreSQL databases.

## Features

- **Backend**: Node.js/Express server with authentication and real-time import progress
- **Frontend**: React application with user login and settings management
- **Import System**: Automatic table creation and data migration from Airtable to PostgreSQL
- **Real-time Updates**: Socket.IO for live progress tracking during imports

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- Airtable API key and base ID

### Installation and Startup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd airtable-import
   ```

2. **Start all services (recommended)**
   ```bash
   # Install dependencies and start both frontend and backend
   ./start-all.sh install
   ```

   This script will:
   - Clean up any processes using development ports
   - Install dependencies for both frontend and backend
   - Start the backend server on port 3001
   - Start the frontend React app on port 3000
   - Handle proper environment setup

3. **Manual startup (alternative)**
   ```bash
   # Backend
   cd backend
   npm install
   npm run start:safe  # or npm run dev:safe for development

   # Frontend (in another terminal)
   cd frontend
   npm install
   npm run start:safe
   ```

### Environment Configuration

The application will automatically create `.env` files with sensible defaults:

**Backend** (`.env`):
```env
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
DATABASE_URL=postgresql://username:password@localhost:5432/airtable_import
```

**Frontend** (`.env.local`):
```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001
```

### Troubleshooting

#### Port Conflicts

If you encounter `EADDRINUSE` errors, the startup scripts automatically handle port cleanup. You can also manually clean up ports:

```bash
# Kill processes on specific ports
lsof -ti:3001 | xargs kill -9 || true
lsof -ti:3000 | xargs kill -9 || true
```

#### JWT Secret Errors

If you see `secretOrPrivateKey must have a value` errors:

1. Ensure `JWT_SECRET` is set in your environment
2. The application provides fallback secrets for development
3. For production, always set a secure JWT secret

#### Development vs Production

- **Development**: Uses safe startup scripts with automatic port cleanup and fallback secrets
- **Production**: Requires proper environment variables and will exit if JWT_SECRET is not set

### API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/settings` - Get user settings
- `POST /api/settings` - Save user settings
- `POST /api/import/start` - Start import process

### Default Credentials

- **Email**: admin@example.com
- **Password**: admin123

### CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci-cd.yml`) that:
- Automatically cleans up ports before starting services
- Sets up proper environment variables for testing
- Runs integration tests with both frontend and backend
- Handles JWT secret configuration for CI environment

## Architecture

```
├── backend/               # Node.js/Express backend
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Authentication middleware
│   │   └── services/     # Business logic
│   ├── start-server.sh   # Safe backend startup script
│   └── package.json
├── frontend/             # React frontend
│   ├── src/
│   ├── start-frontend.sh # Safe frontend startup script
│   └── package.json
├── start-all.sh         # Full stack startup script
└── .github/workflows/   # CI/CD configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Use the provided startup scripts to test
5. Submit a pull request

The startup scripts ensure consistent development environment setup and port management across different machines and CI/CD environments.