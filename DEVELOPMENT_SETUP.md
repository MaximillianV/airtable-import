# Development Environment Setup Guide

This guide provides detailed instructions for setting up a development environment for the Airtable Import project.

## Prerequisites

### Required Software
- **Node.js**: v18.x or higher (v20.x recommended)
- **npm**: v9.x or higher (included with Node.js)
- **PostgreSQL**: v13.x or higher for production database
- **Git**: For version control

### Optional Tools
- **Docker**: For containerized PostgreSQL setup
- **VS Code**: Recommended IDE with suggested extensions
- **Postman**: For API testing

## Database Setup Requirements

### PostgreSQL Setup

#### Option 1: Local PostgreSQL Installation
1. **Install PostgreSQL** (macOS/Linux/Windows)
   ```bash
   # macOS with Homebrew
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   
   # Windows
   # Download installer from https://www.postgresql.org/download/windows/
   ```

2. **Create Database and User**
   ```bash
   # Connect to PostgreSQL
   sudo -u postgres psql
   
   # Create database and user
   CREATE DATABASE airtable_import;
   CREATE USER airtable_user WITH PASSWORD 'airtable_password';
   GRANT ALL PRIVILEGES ON DATABASE airtable_import TO airtable_user;
   \q
   ```

3. **Set Database URL**
   ```env
   DATABASE_URL=postgresql://airtable_user:airtable_password@localhost:5432/airtable_import
   ```

#### Option 2: Docker PostgreSQL
1. **Run PostgreSQL Container**
   ```bash
   docker run --name airtable-postgres \
     -e POSTGRES_DB=airtable_import \
     -e POSTGRES_USER=airtable_user \
     -e POSTGRES_PASSWORD=airtable_password \
     -p 5432:5432 \
     -d postgres:13
   ```

2. **Set Database URL**
   ```env
   DATABASE_URL=postgresql://airtable_user:airtable_password@localhost:5432/airtable_import
   ```

#### Option 3: SQLite (Development/Testing Only)
For development and testing, SQLite is automatically configured:
```env
DATABASE_URL=sqlite::memory:  # In-memory database
# or
DATABASE_URL=sqlite:./dev.db  # File-based database
```

### Database Configuration in Code

The application uses a database abstraction layer (`backend/src/services/database.js`) that automatically handles:
- **SQLite**: When `NODE_ENV=test` or `DATABASE_URL=sqlite::memory:`
- **PostgreSQL**: For all other environments

This allows seamless switching between databases for different use cases:
- **Unit Tests**: SQLite in-memory for fast, isolated tests
- **Development**: PostgreSQL for production-like environment
- **Production**: PostgreSQL with proper connection pooling

## Environment Configuration

### Backend Environment Variables
Create `backend/.env` with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Default Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123

# Database (Choose one)
# PostgreSQL
DATABASE_URL=postgresql://airtable_user:airtable_password@localhost:5432/airtable_import
# OR SQLite for development
# DATABASE_URL=sqlite:./dev.db
```

### Frontend Environment Variables
Create `frontend/.env.local` with:

```env
# Backend API Configuration
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SOCKET_URL=http://localhost:3001

# Optional: Additional React configuration
REACT_APP_DEBUG=true
```

## Development Workflow

### Initial Setup
1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd airtable-import
   ```

2. **Automated Setup (Recommended)**
   ```bash
   ./start-all.sh install
   ```
   This will:
   - Install all dependencies
   - Create environment files with defaults
   - Start both frontend and backend
   - Clean up conflicting processes

3. **Manual Setup (Alternative)**
   ```bash
   # Install root dependencies (Playwright)
   npm install
   
   # Backend setup
   cd backend
   npm install
   npm run start:safe
   
   # Frontend setup (new terminal)
   cd frontend
   npm install
   npm run start:safe
   ```

### Daily Development
```bash
# Start all services
./start-all.sh

# Or start individually
cd backend && npm run dev:safe    # Backend with auto-restart
cd frontend && npm run start:safe # Frontend with hot reload
```

### Testing
```bash
# Run all tests
npm test

# Backend unit tests only
cd backend && npm test

# Frontend tests only
cd frontend && npm test

# End-to-end tests
npm run test:e2e
```

## Port Management

The application uses these default ports:
- **Frontend**: 3000 (React development server)
- **Backend**: 3001 (Express API server)
- **Playwright**: 3002 (During E2E tests)

The startup scripts automatically clean up processes on these ports to prevent conflicts.

## IDE Configuration

### VS Code (Recommended)
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "eslint.workingDirectories": ["frontend", "backend"]
}
```

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- REST Client
- GitLens

### Extensions Configuration
Create `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "humao.rest-client",
    "eamodio.gitlens"
  ]
}
```

## Troubleshooting Common Issues

### Database Connection Issues
1. **PostgreSQL not running**
   ```bash
   # Check if PostgreSQL is running
   pg_isready -h localhost -p 5432
   
   # Start PostgreSQL service
   sudo systemctl start postgresql  # Linux
   brew services start postgresql   # macOS
   ```

2. **Connection refused**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL is listening on port 5432
   - Ensure database and user exist

3. **Permission denied**
   - Verify user has proper permissions on database
   - Check password is correct in DATABASE_URL

### Port Conflicts
```bash
# Find what's using a port
lsof -i :3001

# Kill processes on development ports
./start-all.sh  # Automatically handles this
```

### JWT Secret Issues
- Ensure JWT_SECRET is set in environment
- For production, use a secure random string
- Development fallbacks are provided in startup scripts

### Node.js Version Issues
```bash
# Check Node.js version
node --version

# Use Node Version Manager (nvm) if needed
nvm install 20
nvm use 20
```

## Advanced Configuration

### Custom Database Setup
To use a different database configuration, modify `backend/src/services/database.js`:

1. **Add new database type support**
2. **Update connection logic**
3. **Add appropriate dependencies**

### Environment-Specific Configuration
Create different environment files:
- `.env.development`
- `.env.staging` 
- `.env.production`

The application will automatically load the appropriate file based on `NODE_ENV`.

### Security Considerations
- **Never commit .env files** to version control
- **Use strong JWT secrets** in production
- **Configure proper CORS** settings for production
- **Use environment variables** for all sensitive configuration
- **Enable SSL/TLS** in production PostgreSQL connections

## CI/CD Integration

The project includes GitHub Actions configuration (`.github/workflows/ci-cd.yml`) that:
- Automatically sets up the development environment
- Runs tests with proper database configuration
- Handles port management and service startup
- Provides security scanning and dependency checking

For local CI testing:
```bash
# Run the full CI pipeline locally
npm run test:ci
```

This guide ensures consistent development setup across different machines and environments.