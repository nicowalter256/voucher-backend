import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import voucherRoutes from './routes/vouchers.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/vouchers', voucherRoutes);
app.use('/payments', paymentRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API up on :${PORT}`));
