import express, { Application, Request, Response, NextFunction } from 'express';
import shopRoutes from './routes/shop';

export const createApp = (): Application => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/shop', shopRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // 404 handler for unmatched routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found', path: req.originalUrl });
  });

  // Error middleware - must be registered last
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  return app;
};
