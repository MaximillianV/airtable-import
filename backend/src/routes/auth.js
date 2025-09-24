const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DatabaseService = require('../services/database');

const router = express.Router();

// Initialize database service
const db = new DatabaseService();

// Ensure JWT_SECRET is available with fallback
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn('WARNING: JWT_SECRET not set in environment variables. Using default secret for development only.');
  return 'default-dev-secret-change-this-in-production';
})();

// Validate JWT_SECRET on startup
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET must be set in production environment');
  process.exit(1);
}

/**
 * Initialize default admin user if it doesn't exist
 * This ensures there's always at least one user to log in with
 */
async function initializeDefaultUser() {
  try {
    await db.connect();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    // Check if admin user already exists
    const existingUser = await db.findUserByEmail(adminEmail);
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.createUser(adminEmail, hashedPassword);
      console.log(`✅ Default admin user created: ${adminEmail}`);
    } else {
      console.log(`👤 Admin user already exists: ${adminEmail}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize default user:', error.message);
  }
}

// Initialize default user on startup
initializeDefaultUser();

/**
 * Login endpoint - authenticate user and return JWT token
 * Uses Prisma database service for user lookup and password verification
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database using Prisma
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password against stored hash
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token with user information including role for permission checking
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ User logged in: ${email} (role: ${user.role})`);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Register endpoint - create new user account
 * Uses Prisma database service for user creation with proper validation
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate password strength (minimum requirements)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists using Prisma
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user using Prisma
    const newUser = await db.createUser(email, hashedPassword);

    // Generate JWT token for immediate login including role information
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ New user registered: ${email} (role: ${newUser.role})`);
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    
    // Handle specific Prisma errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Verify token endpoint - validate JWT and return user information
 * Uses Prisma database service to verify user still exists
 */
router.get('/verify', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Decode and verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists in database using Prisma
    const user = await db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;