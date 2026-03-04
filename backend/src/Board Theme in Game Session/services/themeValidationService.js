// Theme Validation Service
// Validates premium board theme ownership before allowing selection

class ThemeValidationService {
  constructor(db) {
    this.db = db;
  }

  async validateThemeOwnership(userId, boardStyleId) {
    if (!boardStyleId) {
      return { valid: true, theme: null };
    }

    // Get board style details
    const theme = await this.db.query(
      'SELECT * FROM board_styles WHERE id = $1',
      [boardStyleId],
    );

    if (!theme.rows.length) {
      return { valid: false, error: 'Board theme not found' };
    }

    const themeData = theme.rows[0];

    // If theme is free, allow it
    if (!themeData.is_premium) {
      return { valid: true, theme: themeData };
    }

    // Check if user owns the premium theme
    const ownership = await this.db.query(
      'SELECT * FROM user_board_styles WHERE user_id = $1 AND board_style_id = $2',
      [userId, boardStyleId],
    );

    if (!ownership.rows.length) {
      return {
        valid: false,
        error: 'Premium theme not owned by user',
      };
    }

    return { valid: true, theme: themeData };
  }
}

module.exports = ThemeValidationService;
