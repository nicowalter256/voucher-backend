import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
const router = Router();

/* POST /auth/register {phone,email,fullname,password} */
router.post('/register', async (req, res) => {
  const { phone, email, fullname, password } = req.body;

  // Validation
  if (!phone || !email || !fullname || !password) {
    return res.status(400).json({ 
      error: 'All fields are required: phone, email, fullname, password' 
    });
  }

  // Phone validation (basic format check)
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ 
      error: 'Invalid phone number format' 
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format' 
    });
  }

  // Fullname validation (at least 2 characters, max 15)
  if (fullname.trim().length < 2 || fullname.trim().length > 15) {
    return res.status(400).json({ 
      error: 'Fullname must be between 2 and 15 characters' 
    });
  }

  // Password validation (at least 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users(phone,email,fullname,password_hash) VALUES($1,$2,$3,$4)',
      [phone.trim(), email.trim().toLowerCase(), fullname.trim(), hash]
    );
    res.sendStatus(201);
  } catch (error) {
    console.error('Registration error details:', {
      message: error.message,
      code: error.code,
      constraint: error.constraint,
      detail: error.detail
    });
    
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint && error.constraint.includes('phone')) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
      if (error.constraint && error.constraint.includes('email')) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }
    
    if (error.code === '42P01') { // Table doesn't exist
      return res.status(500).json({ error: 'Database table not found. Please check your database setup.' });
    }
    
    if (error.code === '28P01') { // Authentication failed
      return res.status(500).json({ error: 'Database connection failed. Please check your database credentials.' });
    }
    
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/* POST /auth/login {email,password} */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format' 
    });
  }

  // Password validation (at least 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ 
      error: 'Password must be at least 6 characters long' 
    });
  }

  try {
    const user = (
      await db.query('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()])
    ).rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });
    // Exclude password_hash from user details
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
