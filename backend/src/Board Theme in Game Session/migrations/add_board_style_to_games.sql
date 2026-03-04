-- Migration: Add board_style_id to games table
-- Description: Allow game hosts to select board themes for multiplayer matches

ALTER TABLE games 
ADD COLUMN board_style_id INTEGER REFERENCES board_styles(id);

-- Add index for better query performance
CREATE INDEX idx_games_board_style_id ON games(board_style_id);

-- Optional: Add constraint to ensure board_style_id is valid when set
ALTER TABLE games 
ADD CONSTRAINT fk_games_board_style 
FOREIGN KEY (board_style_id) 
REFERENCES board_styles(id) 
ON DELETE SET NULL;
