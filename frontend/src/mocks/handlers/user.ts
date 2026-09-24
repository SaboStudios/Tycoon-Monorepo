import { http, HttpResponse } from 'msw';
import { mockUserProfile, mockLeaderboard } from '../fixtures/user';

export const userHandlers = [
  http.get('http://localhost:3001/api/users/me/profile', () => {
    return HttpResponse.json(mockUserProfile);
  }),
  http.get('http://localhost:3001/api/users/leaderboard', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    // paginate mock data
    return HttpResponse.json({
      data: mockLeaderboard,
      page,
      totalPages: 5,
      total: 100
    });
  }),
  http.post('http://localhost:3001/api/users/preferences', () => {
    return HttpResponse.json({ message: 'Preferences updated' });
  }),
  // Add more as needed
];
