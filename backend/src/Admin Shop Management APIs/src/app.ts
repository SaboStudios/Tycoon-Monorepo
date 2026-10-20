import express, { NextFunction, Request, Response } from 'express';
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

// 404 handler for any route that didn't match above.
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Error middleware: catches anything thrown/forwarded by the routes above
// instead of letting it fall through to Express's default HTML error page.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({
    error: 'Internal Server Error',
    message: err.message ?? 'Unexpected error',
  });
});

export default app;
