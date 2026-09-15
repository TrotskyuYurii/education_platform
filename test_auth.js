import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
dotenv.config();
const token = jwt.sign({ id: 'any', role: 'admin', roleKeys: ['admin'] }, process.env.JWT_SECRET || 'secret');
console.log(token);
