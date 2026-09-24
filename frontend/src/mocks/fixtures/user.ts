export const mockUserProfile = {
  id: 1,
  username: 'demoPlayer',
  email: 'player@example.com',
  gamesPlayed: 42,
  gamesWon: 15,
  gamesLost: 27,
  totalStaked: 5000,
  totalEarned: 2500,
  totalWithdrawn: 1000,
  role: 'player',
  isSuspended: false
};

export const mockUsers = [
  mockUserProfile,
  {
    id: 2,
    username: 'rivalPlayer',
    gamesPlayed: 35,
    gamesWon: 20,
    gamesLost: 15,
    totalStaked: 8000,
    totalEarned: 4000,
    totalWithdrawn: 2000
  }
];

export const mockLeaderboard = mockUsers;
