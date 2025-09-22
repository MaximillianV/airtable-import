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

### Google TypeScript Style Guide Compliance
Follow the [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) with these project-specific adaptations:

### TypeScript/JavaScript Style
- **Backend**: CommonJS modules (`require`/`module.exports`)
- **Frontend**: ES6 modules (`import`/`export`)
- **Naming Conventions**:
  - `camelCase` for variables, functions, methods, and properties
  - `PascalCase` for classes, interfaces, types, and React components  
  - `SCREAMING_SNAKE_CASE` for constants and environment variables
  - `kebab-case` for file names and URLs
- **Async Operations**: Always use `async/await` over Promises for better readability
- **Error Handling**: Always use try-catch blocks for async operations

### Code Documentation & Comments
**REQUIRED: Every function, class, and complex logic block must have descriptive comments explaining what it does and why.**

#### Comment Standards:
```typescript
/**
 * Authenticates user credentials against the database and returns JWT token.
 * This function handles both email/password validation and token generation.
 * 
 * @param email - User's email address for authentication
 * @param password - User's plain text password (will be hashed for comparison)
 * @returns Promise containing JWT token and user information
 * @throws {Error} When credentials are invalid or database connection fails
 */
async function authenticateUser(email: string, password: string): Promise<AuthResult> {
  // Validate input parameters before processing
  if (!email || !password) {
    throw new Error('Email and password are required for authentication');
  }
  
  // Find user in database by email address
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials provided');
  }
  
  // Compare provided password with stored hash using bcrypt
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials provided');
  }
  
  // Generate JWT token with user information and expiration
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return { token, user };
}
```

#### JavaScript/Node.js Comments:
```javascript
// Configure JWT secret with fallback for development environments
// In production, JWT_SECRET must be set as environment variable
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: Using default JWT secret for development only');
  return 'default-dev-secret-change-this-in-production';
})();

// Express route handler for user authentication
// Validates credentials and returns JWT token for session management
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields are present in request
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Authenticate user and generate token
    const result = await authenticateUser(email, password);
    
    // Return successful authentication response
    res.json({
      token: result.token,
      user: result.user
    });
  } catch (error) {
    // Log error for debugging and return generic error message
    console.error('Authentication failed:', error.message);
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

#### React Component Comments:
```typescript
/**
 * Dashboard component that displays import sessions and user management.
 * Provides navigation to settings and import functionality.
 * Handles authentication state and redirects unauthorized users.
 */
const Dashboard: React.FC = () => {
  // State management for dashboard data and loading states
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);
  
  // Authentication context and navigation hooks
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Load dashboard data on component mount
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Loads user settings and import sessions from the API.
   * Updates component state based on API responses.
   * Handles errors gracefully without breaking the UI.
   */
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Check if user has configured Airtable and database settings
      const settings = await settingsAPI.get();
      setHasSettings(!!(settings.airtableApiKey && settings.airtableBaseId && settings.databaseUrl));
      
      // Load historical import sessions for display
      try {
        const sessionsData = await importAPI.getSessions();
        setSessions(sessionsData);
      } catch (error) {
        // It's acceptable if no sessions exist yet for new users
        setSessions([]);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Component render logic...
};
```

### Best Practices for All Code

#### 1. Function and Variable Naming
```typescript
// ✅ GOOD: Descriptive function names that explain what they do
async function validateAirtableConnection(apiKey: string, baseId: string): Promise<boolean>
async function createDatabaseTableFromSchema(tableName: string, fields: AirtableField[]): Promise<void>
function calculateImportProgress(processedRecords: number, totalRecords: number): number

// ❌ BAD: Vague or abbreviated names
async function validate(key: string, id: string): Promise<boolean>
async function createTable(name: string, fields: any[]): Promise<void>
function calcProgress(proc: number, total: number): number
```

#### 2. Error Handling and Logging
```typescript
// ✅ GOOD: Comprehensive error handling with context
try {
  const result = await importAirtableData(tableName, apiKey, baseId);
  console.log(`Successfully imported ${result.recordCount} records from table ${tableName}`);
  return result;
} catch (error) {
  console.error(`Failed to import data from Airtable table ${tableName}:`, error.message);
  throw new Error(`Import failed for table ${tableName}: ${error.message}`);
}

// ❌ BAD: Generic error handling without context
try {
  const result = await importData(tableName);
  return result;
} catch (error) {
  console.error('Error:', error);
  throw error;
}
```

#### 3. Type Safety (TypeScript)
```typescript
// ✅ GOOD: Explicit types and interfaces
interface ImportSession {
  sessionId: string;
  status: 'starting' | 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  tableNames: string[];
  results?: ImportResult[];
  error?: string;
}

async function startImportSession(tableNames: string[]): Promise<ImportSession> {
  // Implementation with type-safe operations
}

// ❌ BAD: Using 'any' or missing types
async function startImport(tables: any): Promise<any> {
  // Implementation without type safety
}
```

#### 4. Database Query Documentation
```javascript
// ✅ GOOD: Documented SQL operations with parameter explanations
/**
 * Creates a new table in PostgreSQL based on Airtable field schema.
 * Automatically maps Airtable field types to appropriate PostgreSQL types.
 * 
 * @param {string} tableName - Name of the table to create (must be valid SQL identifier)
 * @param {Array} fields - Airtable field definitions with type information
 * @returns {Promise<boolean>} True if table creation successful
 */
async function createTableFromAirtableSchema(tableName, fields) {
  // Validate table name to prevent SQL injection
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Build CREATE TABLE statement with appropriate column types
  const columnDefinitions = fields.map(field => {
    const columnType = mapAirtableTypeToPostgreSQL(field.type);
    return `"${field.name}" ${columnType}`;
  }).join(', ');
  
  // Execute table creation with parameterized query
  const createQuery = `CREATE TABLE IF NOT EXISTS "${sanitizedTableName}" (${columnDefinitions})`;
  await this.query(createQuery);
  
  console.log(`Created table ${sanitizedTableName} with ${fields.length} columns`);
  return true;
}
```

### React Component Patterns
- **Functional Components**: Use React.FC type annotation with explicit interfaces
- **Hooks**: useState, useEffect, useContext for state management (document what each state represents)
- **Props**: Define TypeScript interfaces for component props with JSDoc comments
- **Styling**: Inline styles with consistent design tokens (comment style object purposes)
- **File Structure**: Component name matches filename (e.g., `Dashboard.tsx`)
- **Component Documentation**: Every component must have a JSDoc comment explaining its purpose

#### React Component Documentation Standard:
```typescript
/**
 * Props interface for the ImportProgress component.
 * Defines the data structure for displaying real-time import status.
 */
interface ImportProgressProps {
  /** Current import session containing progress information */
  session: ImportSession;
  /** Callback function triggered when import is cancelled by user */
  onCancel: () => void;
  /** Optional CSS class name for custom styling */
  className?: string;
}

/**
 * ImportProgress component displays real-time progress of Airtable data import.
 * Shows progress bars, record counts, and status updates via Socket.IO connection.
 * Allows users to cancel ongoing import operations.
 * 
 * @param props - Component props containing session data and callbacks
 * @returns JSX element displaying import progress information
 */
const ImportProgress: React.FC<ImportProgressProps> = ({ session, onCancel, className }) => {
  // State for tracking real-time progress updates from Socket.IO
  const [progress, setProgress] = useState<Record<string, ImportProgress>>({});
  
  // Effect to establish Socket.IO connection for real-time updates
  useEffect(() => {
    // Connect to Socket.IO server for progress updates
    const unsubscribe = socketService.onProgressUpdate((data: ImportProgress) => {
      setProgress(prev => ({
        ...prev,
        [data.table]: data  // Update progress for specific table
      }));
    });
    
    // Cleanup Socket.IO connection on component unmount
    return () => {
      unsubscribe();
    };
  }, []);
  
  // Render progress UI with progress bars and status information
  return (
    <div className={className} style={styles.container}>
      {/* Progress display implementation */}
    </div>
  );
};

// Style object with comments explaining each style's purpose
const styles = {
  // Main container for progress display with proper spacing and background
  container: {
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  // Progress bar container with visual feedback styling
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden'
  }
};
```

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

### MANDATORY Requirements (Following Google TypeScript Style Guide)

1. **Code Documentation**: EVERY function, class, component, and complex logic block MUST have descriptive comments explaining:
   - What the code does
   - Why it was implemented this way
   - Any important business logic or edge cases
   - Parameters and return values (use JSDoc format)

2. **Google TypeScript Style Guide Compliance**: 
   - Follow naming conventions (camelCase, PascalCase, SCREAMING_SNAKE_CASE)
   - Use explicit types instead of `any`
   - Add JSDoc comments for all public functions and components
   - Use descriptive variable and function names
   - Prefer `const` over `let` when possible

3. **Error Handling**: Always include proper try-catch blocks with:
   - Descriptive error messages that include context
   - Proper logging for debugging
   - User-friendly error responses for API endpoints

4. **Type Safety**: 
   - Use TypeScript interfaces with JSDoc comments
   - Define explicit return types for functions
   - Avoid `any` type - use proper interfaces or union types

5. **Code Readability**:
   - Add inline comments explaining complex business logic
   - Use descriptive variable names that explain their purpose
   - Break down complex functions into smaller, well-documented helper functions

### Example of Required Code Quality:

```typescript
/**
 * Service class for managing Airtable API connections and data retrieval.
 * Handles authentication, rate limiting, and error recovery for Airtable operations.
 */
class AirtableService {
  private apiKey: string;
  private baseId: string;
  private base: any; // Airtable base instance

  /**
   * Initialize Airtable service with API credentials.
   * Validates credentials and establishes connection to specified base.
   * 
   * @param apiKey - Airtable API key for authentication
   * @param baseId - Unique identifier for the Airtable base
   * @throws {Error} When credentials are invalid or base is inaccessible
   */
  constructor(apiKey: string, baseId: string) {
    // Validate required parameters before initialization
    if (!apiKey || !baseId) {
      throw new Error('Airtable API key and base ID are required for service initialization');
    }
    
    this.apiKey = apiKey;
    this.baseId = baseId;
    
    // Initialize Airtable base connection with provided credentials
    this.base = new Airtable({ apiKey }).base(baseId);
  }

  /**
   * Retrieves all records from specified Airtable table with pagination handling.
   * Automatically handles Airtable's rate limiting and pagination.
   * 
   * @param tableName - Name of the table to retrieve records from
   * @returns Promise resolving to array of all records in the table
   * @throws {Error} When table is not found or API request fails
   */
  async getAllRecords(tableName: string): Promise<AirtableRecord[]> {
    try {
      const records: AirtableRecord[] = [];
      
      // Use Airtable's eachPage method to handle pagination automatically
      await this.base(tableName).select().eachPage((pageRecords, fetchNextPage) => {
        // Add each page of records to our collection
        records.push(...pageRecords);
        
        // Continue to next page (Airtable handles rate limiting internally)
        fetchNextPage();
      });
      
      console.log(`Successfully retrieved ${records.length} records from table ${tableName}`);
      return records;
    } catch (error) {
      console.error(`Failed to retrieve records from Airtable table ${tableName}:`, error.message);
      throw new Error(`Airtable API error for table ${tableName}: ${error.message}`);
    }
  }
}
```

### Additional Requirements

6. **Testing**: Write tests for new functionality with descriptive test names and comments
7. **Documentation**: Update README.md when adding features that change setup or usage
8. **Environment**: Consider both development and production configurations with proper comments
9. **Security**: Validate inputs and handle sensitive data with documented security measures
10. **Performance**: Add comments explaining performance optimizations and database query choices

## Important Notes for Copilot

### Code Quality Standards (CRITICAL)
- **EVERY piece of code must be well-documented with comments explaining what it does and why**
- **Follow Google TypeScript Style Guide religiously** - this is non-negotiable
- **Use descriptive variable and function names** - code should be self-documenting
- **Add JSDoc comments for all public functions, components, and classes**
- **Inline comments are required for complex business logic and non-obvious code**

### Project-Specific Guidelines
- This project uses startup scripts for reliable development environment setup
- Database abstraction allows testing with SQLite and production with PostgreSQL  
- Real-time features require Socket.IO coordination between frontend and backend
- Authentication is JWT-based with fallback secrets for development convenience
- The application automatically creates database tables based on Airtable schema
- All API endpoints should include proper error handling and validation
- React components use inline styles with consistent design patterns (document style purposes)
- Testing strategy separates unit tests (SQLite) from integration tests (PostgreSQL)

### Human Readability Requirements
- **Comment every function explaining its purpose, parameters, and return values**
- **Add inline comments for any logic that isn't immediately obvious**
- **Use meaningful variable names that describe the data they contain**
- **Document any business rules or domain-specific logic**
- **Explain why certain approaches were chosen over alternatives**