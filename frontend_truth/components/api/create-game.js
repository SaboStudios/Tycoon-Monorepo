// pages/api/create-game.js
import { pool } from '../../../blockopoly-backend/src/config/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    gameId,
    maxPlayers,
    privateRoom,
    auction,
    rentInPrison,
    mortgage,
    evenBuild,
    startingCash,
    randomPlayOrder,
    address,
  } = req.body;

  try {
    // Insert into game_settings
    await pool.query(
      `
      INSERT INTO game_settings (
        game_id, max_players, private_room, auction, rent_in_prison,
        mortgage, even_build, starting_cash, randomize_play_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        gameId,
        maxPlayers,
        privateRoom,
        auction,
        rentInPrison,
        mortgage,
        evenBuild,
        startingCash,
        randomPlayOrder,
      ]
    );

    // Insert into games
    await pool.query(
      `
      INSERT INTO games (
        id, status, created_at, number_of_players, ended_at, created_by,
        mode, players_joined, is_initialised, ready_to_start, rolls_count,
        rolls_times, has_thrown_dice
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        gameId,
        'Pending',
        Math.floor(Date.now() / 1000),
        maxPlayers,
        0,
        address,
        privateRoom ? 'PrivateGame' : 'PublicGame',
        1,
        false,
        false,
        0,
        0,
        false,
      ]
    );

    // Insert into game_players_map
    await pool.query(
      `
      INSERT INTO game_players_map (game_id, player_address, is_in_game)
      VALUES ($1, $2, $3)
      `,
      [gameId, address, true]
    );

    res.status(200).json({ success: true, gameId });
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: 'Failed to create game' });
  }
}