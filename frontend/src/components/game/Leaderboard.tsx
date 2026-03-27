'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/ui/spinner';
import { Share2, Trophy, Medal, User } from 'lucide-react';

interface LeaderboardUser {
  id: number;
  username: string;
  game_won: number;
  games_played: number;
  total_earned: string;
}

export function Leaderboard() {
  const { t } = useTranslation('common');
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLeaderboard();
  }, [page]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/users/leaderboard?page=${page}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const result = await response.json();
      setData(result.data);
      setTotalPages(result.meta.totalPages);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      toast.error('Could not load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const handleShareProfile = (username: string) => {
    const profileUrl = `${window.location.origin}/profile/${username}`;
    navigator.clipboard.writeText(profileUrl);
    toast.info(t('leaderboard.copied'), {
      icon: <Share2 className="text-cyan-400" size={16} />,
    });
  };

  const getRankIcon = (index: number) => {
    const rank = index + 1 + (page - 1) * 10;
    if (rank === 1) return <Trophy className="text-yellow-400" size={20} />;
    if (rank === 2) return <Medal className="text-gray-400" size={20} />;
    if (rank === 3) return <Medal className="text-amber-600" size={20} />;
    return <span className="text-neutral-500 font-mono text-sm">{rank}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Trophy className="text-cyan-400" />
          {t('leaderboard.title')}
        </h1>
      </div>

      <Card className="border-neutral-800 bg-neutral-900/50 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-left border-collapse">
            <thead className="border-b border-neutral-800 bg-neutral-900/80">
              <tr className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                <th className="px-6 py-4 font-bold">{t('leaderboard.rank')}</th>
                <th className="px-6 py-4 font-bold">{t('leaderboard.player')}</th>
                <th className="px-6 py-4 font-bold text-center">{t('leaderboard.wins')}</th>
                <th className="px-6 py-4 font-bold text-center">{t('leaderboard.earned')}</th>
                <th className="px-6 py-4 font-bold text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex justify-center"><Spinner /></div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-neutral-500">
                    Leaderboard is empty.
                  </td>
                </tr>
              ) : (
                data.map((user, index) => (
                  <tr key={user.id} className="border-b border-neutral-800/50 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 text-center w-16">
                      {getRankIcon(index)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700" aria-hidden="true">
                          <User className="text-neutral-500" size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-white">{user.username || 'Anonymous'}</div>
                          <div className="text-xs text-neutral-500">{user.games_played} games</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-cyan-400">
                      {user.game_won}
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-neutral-300">
                      {parseFloat(user.total_earned).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShareProfile(user.username)}
                        className="text-neutral-500 hover:text-cyan-400 hover:bg-cyan-400/10"
                        title={t('leaderboard.share_profile')}
                        aria-label={`${t('leaderboard.share_profile')} ${user.username}`}
                      >
                        <Share2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          >
            Previous
          </Button>
          <div className="flex items-center px-4 text-neutral-500 font-mono">
            {page} / {totalPages}
          </div>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="border-neutral-800 text-neutral-400 hover:bg-neutral-800"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
