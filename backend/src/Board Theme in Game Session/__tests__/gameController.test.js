// Tests for Game Controller

const GameController = require('../controllers/gameController');

describe('GameController', () => {
  let controller;
  let mockDb;
  let mockWebsocketService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    };
    mockWebsocketService = {
      broadcastToGame: jest.fn(),
    };
    controller = new GameController(mockDb, mockWebsocketService);

    mockReq = {
      user: { id: 1 },
      body: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('createGame', () => {
    test('should create game without theme', async () => {
      const newGame = { id: 1, host_id: 1, board_style_id: null };
      mockDb.query.mockResolvedValueOnce({ rows: [newGame] });

      await controller.createGame(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        game: newGame,
        theme: null,
      });
    });

    test('should create game with free theme', async () => {
      const freeTheme = { id: 1, name: 'Classic', is_premium: false };
      const newGame = { id: 1, host_id: 1, board_style_id: 1 };

      mockReq.body.board_style_id = 1;
      mockDb.query
        .mockResolvedValueOnce({ rows: [freeTheme] })
        .mockResolvedValueOnce({ rows: [newGame] });

      await controller.createGame(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        game: newGame,
        theme: freeTheme,
      });
    });

    test('should reject if premium theme not owned', async () => {
      const premiumTheme = { id: 5, name: 'Ocean Blue', is_premium: true };

      mockReq.body.board_style_id = 5;
      mockDb.query
        .mockResolvedValueOnce({ rows: [premiumTheme] })
        .mockResolvedValueOnce({ rows: [] });

      await controller.createGame(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Premium theme not owned by user',
      });
    });

    test('should handle database errors', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB Error'));

      await controller.createGame(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to create game',
      });
    });
  });

  describe('updateGameTheme', () => {
    test('should return 404 if game not found', async () => {
      mockReq.params.gameId = 999;
      mockReq.body.board_style_id = 1;
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await controller.updateGameTheme(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Game not found',
      });
    });

    test('should return 403 if user is not host', async () => {
      const game = { id: 1, host_id: 2 };
      mockReq.params.gameId = 1;
      mockReq.body.board_style_id = 1;
      mockReq.user.id = 1;
      mockDb.query.mockResolvedValueOnce({ rows: [game] });

      await controller.updateGameTheme(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Only host can change theme',
      });
    });

    test('should update theme and broadcast to players', async () => {
      const game = { id: 1, host_id: 1 };
      const theme = { id: 5, name: 'Ocean Blue', is_premium: true };
      const ownership = { user_id: 1, board_style_id: 5 };

      mockReq.params.gameId = 1;
      mockReq.body.board_style_id = 5;
      mockReq.user.id = 1;

      mockDb.query
        .mockResolvedValueOnce({ rows: [game] })
        .mockResolvedValueOnce({ rows: [theme] })
        .mockResolvedValueOnce({ rows: [ownership] })
        .mockResolvedValueOnce({ rows: [] });

      await controller.updateGameTheme(mockReq, mockRes);

      expect(mockDb.query).toHaveBeenCalledWith(
        'UPDATE games SET board_style_id = $1 WHERE id = $2',
        [5, 1],
      );
      expect(mockWebsocketService.broadcastToGame).toHaveBeenCalledWith(1, {
        type: 'THEME_UPDATED',
        payload: {
          board_style_id: 5,
          theme,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        theme,
      });
    });

    test('should handle broadcast errors gracefully', async () => {
      const game = { id: 1, host_id: 1 };
      const theme = { id: 1, name: 'Classic', is_premium: false };

      mockReq.params.gameId = 1;
      mockReq.body.board_style_id = 1;

      mockDb.query
        .mockResolvedValueOnce({ rows: [game] })
        .mockResolvedValueOnce({ rows: [theme] })
        .mockResolvedValueOnce({ rows: [] });

      mockWebsocketService.broadcastToGame.mockRejectedValueOnce(
        new Error('Broadcast failed'),
      );

      await controller.updateGameTheme(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
