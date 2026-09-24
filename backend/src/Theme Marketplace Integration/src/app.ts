import express, { Application } from 'express';
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

  return app;
};
