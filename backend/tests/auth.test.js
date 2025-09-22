const request = require('supertest');
const express = require('express');
const authRoutes = require('../src/routes/auth');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
};

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@example.com');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid credentials');
    });

    test('should reject missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'admin123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email and password are required');
    });

    test('should reject missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('POST /auth/register', () => {
    test('should register new user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'newpassword123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@example.com');
    });

    test('should reject duplicate email', async () => {
      // Try to register with existing admin email
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'somepassword'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('User already exists');
    });

    test('should reject missing email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          password: 'somepassword'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email and password are required');
    });
  });

  describe('GET /auth/verify', () => {
    test('should verify valid token', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123'
        });

      const token = loginResponse.body.token;

      // Then verify the token
      const response = await request(app)
        .get('/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('admin@example.com');
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .get('/auth/verify');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No token provided');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid token');
    });
  });
});