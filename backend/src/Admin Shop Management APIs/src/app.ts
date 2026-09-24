import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import shopRoutes from './routes/shopRoutes';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
