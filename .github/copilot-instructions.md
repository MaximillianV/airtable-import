# Copilot Instructions for Airtable Import Project

## Project Overview

This is a full-stack TypeScript/JavaScript application that imports Airtable bases into PostgreSQL databases. The application features automatic table creation, real-time progress tracking, and a modern React frontend.

**Key Purpose**: Provide a seamless way to migrate Airtable data to PostgreSQL with automatic schema detection and creation.

## Architecture & Technology Stack

### Backend (Node.js/Express)
- **Framework**: Express.js with middleware for CORS, helmet security
- **Database**: PostgreSQL (production) + SQLite (testing)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Real-time**: Socket.IO for progress updates during imports
- **External APIs**: Airtable API integration
- **Testing**: Jest with SQLite in-memory database

### Frontend (React + TypeScript)
- **Framework**: React 19+ with TypeScript 4.9+
- **Routing**: React Router v6 with protected routes
- **State Management**: React Context API for authentication
- **Styling**: Inline styles with consistent design system
- **Real-time**: Socket.IO client for progress updates
- **HTTP Client**: Axios for API calls

### Development Tools
- **Package Manager**: npm
- **Build Tools**: React Scripts (Create React App)
- **Testing**: Jest (backend) + React Testing Library (frontend)
- **CI/CD**: GitHub Actions with PostgreSQL service
- **Environment**: .env files for configuration

## Project Structure

```
├── backend/                 # Node.js Express server
│   ├── src/
│   │   ├── routes/         # API endpoints (auth, import, settings)
│   │   ├── middleware/     # Authentication & security middleware
│   │   └── services/       # Business logic (airtable, database, import)
│   ├── tests/              # Jest test files
│   ├── start-server.sh     # Safe startup script with port cleanup
│   └── package.json        # Backend dependencies
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/     # React components (TSX files)
│   │   ├── contexts/       # React Context providers
│   │   ├── services/       # API service layer & Socket.IO
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Utility functions
│   ├── start-frontend.sh   # Safe startup script
│   └── package.json        # Frontend dependencies
├── start-all.sh           # Full-stack startup script
└── .github/
    └── workflows/          # CI/CD pipeline configuration
```

## Coding Standards & Conventions

### TypeScript/JavaScript Style
- **Backend**: CommonJS modules (`require`/`module.exports`)
- **Frontend**: ES6 modules (`import`/`export`)
- **Naming**: camelCase for variables/functions, PascalCase for React components
- **Async**: Prefer `async/await` over Promises for better readability
- **Error Handling**: Always use try-catch blocks for async operations

### React Component Patterns
- **Functional Components**: Use React.FC type annotation
- **Hooks**: useState, useEffect, useContext for state management
- **Props**: Define TypeScript interfaces for component props
- **Styling**: Inline styles using consistent design tokens
- **File Structure**: Component name matches filename (e.g., `Dashboard.tsx`)

### API Design
- **REST Endpoints**: Follow RESTful conventions
- **Error Responses**: Consistent JSON error format with status codes
- **Authentication**: JWT bearer tokens in Authorization header
- **Validation**: Server-side input validation for all endpoints

### Database Patterns
- **Abstraction**: Database service layer for cross-database compatibility
- **Migrations**: Dynamic table creation based on Airtable schema
- **Testing**: Use SQLite in-memory for unit tests, PostgreSQL for integration
- **Connections**: Proper connection pooling and cleanup

### Environment Configuration
- **Development**: Automatic .env file creation with sensible defaults
- **Production**: Strict environment variable validation
- **Security**: JWT_SECRET required in production, fallbacks for development
- **Ports**: Development ports 3000 (frontend), 3001 (backend)

## Development Workflow

### Getting Started
1. **Full Stack**: `./start-all.sh install` - Installs dependencies and starts both services
2. **Backend Only**: `cd backend && npm run start:safe` - Safe startup with port cleanup
3. **Frontend Only**: `cd frontend && npm run start:safe` - Safe startup with environment setup

### Testing Strategy
- **Unit Tests**: Jest for backend logic with SQLite in-memory database
- **Integration Tests**: Full PostgreSQL database with real connections
- **Frontend Tests**: React Testing Library for component testing
- **CI/CD**: Automated testing on push/PR with GitHub Actions

### Port Management
- **Automatic Cleanup**: Startup scripts kill processes on ports 3000, 3001, 3002, 8001
- **Health Checks**: Wait for services to be ready before proceeding
- **Error Recovery**: Graceful handling of port conflicts and startup failures

## Key Features & Business Logic

### Authentication System
- **Default Credentials**: admin@example.com / admin123 (development)
- **JWT Tokens**: Secure authentication with configurable secrets
- **Protected Routes**: Frontend route guards for authenticated access
- **Session Management**: Token-based sessions with logout functionality

### Airtable Integration
- **API Connection**: Airtable.js library for base access
- **Table Discovery**: Dynamic table listing and schema detection
- **Data Fetching**: Paginated record retrieval with progress tracking
- **Field Mapping**: Automatic PostgreSQL column type mapping

### Database Operations
- **Schema Creation**: Dynamic table creation from Airtable field types
- **Data Import**: Batch insertion with transaction support
- **Progress Tracking**: Real-time updates via Socket.IO
- **Error Recovery**: Graceful handling of import failures

### Real-time Updates
- **Socket.IO**: Bidirectional communication for progress updates
- **Event Types**: Import progress, completion, errors
- **Client Updates**: Live progress bars and status indicators

## Common Patterns & Examples

### API Endpoint Pattern
```javascript
router.post('/endpoint', async (req, res) => {
  try {
    // Validate input
    const { param } = req.body;
    if (!param) {
      return res.status(400).json({ error: 'Parameter required' });
    }
    
    // Business logic
    const result = await service.operation(param);
    
    // Success response
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Operation failed:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### React Component Pattern
```typescript
interface ComponentProps {
  title: string;
  onAction: () => void;
}

const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    try {
      setLoading(true);
      await onAction();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={styles.container}>
      <h1>{title}</h1>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Action'}
      </button>
    </div>
  );
};
```

### Service Layer Pattern
```javascript
class ServiceClass {
  constructor() {
    this.connection = null;
  }
  
  async connect(config) {
    try {
      this.connection = await createConnection(config);
      return { success: true };
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
  
  async operation(params) {
    if (!this.connection) {
      throw new Error('Service not connected');
    }
    
    // Implementation
    return result;
  }
}
```

## Testing Guidelines

### Backend Tests
- **Database**: Use SQLite in-memory for unit tests
- **Mocking**: Mock external services (Airtable API)
- **Coverage**: Test all service methods and API endpoints
- **Environment**: NODE_ENV=test with test-specific configuration

### Frontend Tests
- **Components**: Test rendering and user interactions
- **Context**: Test authentication flow and state management
- **API Calls**: Mock API responses for consistent testing
- **Accessibility**: Include basic accessibility testing

### Integration Tests
- **Full Stack**: Test complete user workflows
- **Database**: Use PostgreSQL for realistic testing
- **Real APIs**: Test with actual Airtable connections (when possible)
- **Error Scenarios**: Test failure modes and recovery

## Security Considerations

### Authentication
- **JWT Secrets**: Always use secure secrets in production
- **Password Hashing**: bcrypt with appropriate salt rounds
- **Token Validation**: Verify JWT signatures and expiration
- **Environment Variables**: Never commit secrets to repository

### API Security
- **CORS**: Configured for frontend domain
- **Helmet**: Security headers and protection middleware
- **Input Validation**: Sanitize and validate all user inputs
- **Error Handling**: Don't expose sensitive information in errors

### Database Security
- **Connection Strings**: Use environment variables for database URLs
- **SQL Injection**: Use parameterized queries and ORM methods
- **Access Control**: Implement proper user permissions
- **Data Validation**: Validate data types and constraints

## Deployment & Environment

### Development Environment
- **Automatic Setup**: Scripts create .env files with defaults
- **Port Management**: Automatic cleanup of conflicting processes
- **Hot Reload**: Frontend and backend development servers
- **Database**: PostgreSQL for local development

### Production Environment
- **Environment Variables**: All configuration via environment
- **Security**: Strict validation of required secrets
- **Database**: PostgreSQL with proper connection pooling
- **Logging**: Comprehensive error logging and monitoring

### CI/CD Pipeline
- **Testing**: Automated unit and integration tests
- **Build**: Frontend build and artifact generation
- **Database**: PostgreSQL service for integration tests
- **Security**: Environment variable validation

## Troubleshooting Common Issues

### Port Conflicts
- **Solution**: Use startup scripts that automatically clean ports
- **Manual**: `lsof -ti:3001 | xargs kill -9 || true`

### JWT Errors
- **Solution**: Ensure JWT_SECRET is set in environment
- **Development**: Scripts provide fallback secrets automatically

### Database Connection
- **Solution**: Verify DATABASE_URL and PostgreSQL service status
- **Testing**: Use SQLite for unit tests to avoid connection issues

### Build Failures
- **Solution**: Clear node_modules and package-lock.json, reinstall
- **Dependencies**: Use exact versions in package-lock.json

## When Writing Code

1. **Follow Existing Patterns**: Maintain consistency with established code styles
2. **Error Handling**: Always include proper try-catch blocks and error responses
3. **Type Safety**: Use TypeScript interfaces and proper type annotations
4. **Testing**: Write tests for new functionality using existing patterns
5. **Documentation**: Update README.md if adding new features or changing setup
6. **Environment**: Consider both development and production configurations
7. **Security**: Validate inputs and handle sensitive data appropriately
8. **Performance**: Consider database query optimization and real-time updates

## Important Notes for Copilot

- This project uses startup scripts for reliable development environment setup
- Database abstraction allows testing with SQLite and production with PostgreSQL
- Real-time features require Socket.IO coordination between frontend and backend
- Authentication is JWT-based with fallback secrets for development convenience
- The application automatically creates database tables based on Airtable schema
- All API endpoints should include proper error handling and validation
- React components use inline styles with consistent design patterns
- Testing strategy separates unit tests (SQLite) from integration tests (PostgreSQL)