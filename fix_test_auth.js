import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();

// Ah, it expects token in cookies, not in Bearer header!
console.log('requireAuth uses cookies.token');
