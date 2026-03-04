// Game Routes
// API endpoints for game management

const express = require('express');
const router = express.Router();

module.exports = (gameController, authMiddleware) => {
  // Create new game with optional theme
  router.post('/games', authMiddleware, (req, res) =>
    gameController.createGame(req, res),
  );

  // Update game theme (host only)
  router.patch('/games/:gameId/theme', authMiddleware, (req, res) =>
    gameController.updateGameTheme(req, res),
  );

  return router;
};
