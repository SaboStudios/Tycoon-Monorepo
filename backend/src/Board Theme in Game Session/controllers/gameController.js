// Game Controller
// Handles game creation and theme selection

const ThemeValidationService = require('../services/themeValidationService');

class GameController {
  constructor(db, websocketService) {
    this.db = db;
    this.websocketService = websocketService;
    this.themeValidator = new ThemeValidationService(db);
  }

  async createGame(req, res) {
    const { board_style_id } = req.body;
    const hostId = req.user.id;

    try {
      // Validate theme ownership if provided
      const validation = await this.themeValidator.validateThemeOwnership(
        hostId,
        board_style_id,
      );

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      // Create game with selected theme
      const result = await this.db.query(
        `INSERT INTO games (host_id, board_style_id, status, created_at) 
         VALUES ($1, $2, 'waiting', NOW()) 
         RETURNING *`,
        [hostId, board_style_id],
      );

      const game = result.rows[0];

      res.status(201).json({
        game,
        theme: validation.theme,
      });
    } catch (error) {
      console.error('Error creating game:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  }

  async updateGameTheme(req, res) {
    const { gameId } = req.params;
    const { board_style_id } = req.body;
    const userId = req.user.id;

    try {
      // Verify user is the host
      const game = await this.db.query('SELECT * FROM games WHERE id = $1', [
        gameId,
      ]);

      if (!game.rows.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      if (game.rows[0].host_id !== userId) {
        return res.status(403).json({ error: 'Only host can change theme' });
      }

      // Validate theme ownership
      const validation = await this.themeValidator.validateThemeOwnership(
        userId,
        board_style_id,
      );

      if (!validation.valid) {
        return res.status(403).json({ error: validation.error });
      }

      // Update game theme
      await this.db.query(
        'UPDATE games SET board_style_id = $1 WHERE id = $2',
        [board_style_id, gameId],
      );

      // Broadcast theme change to all players
      await this.websocketService.broadcastToGame(gameId, {
        type: 'THEME_UPDATED',
        payload: {
          board_style_id,
          theme: validation.theme,
        },
      });

      res.json({
        success: true,
        theme: validation.theme,
      });
    } catch (error) {
      console.error('Error updating game theme:', error);
      res.status(500).json({ error: 'Failed to update theme' });
    }
  }
}

module.exports = GameController;
