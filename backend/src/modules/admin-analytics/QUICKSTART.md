# Quick Start Guide - Admin Dashboard Analytics

## 🚀 Getting Started in 5 Minutes

### Step 1: Verify Installation
The module is already integrated into your application. Check that it's imported in `app.module.ts`:

```bash
grep -n "AdminAnalyticsModule" backend/src/app.module.ts
```

You should see:
```
34:import { AdminAnalyticsModule } from './modules/admin-analytics/admin-analytics.module';
92:    AdminAnalyticsModule,
```

### Step 2: Start Your Backend
```bash
cd backend
npm run start:dev
# or
bun run start:dev
```

### Step 3: Get Admin Token
Login as an admin user to get a JWT token:

```bash
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-password"
  }'
```

Save the `access_token` from the response.

### Step 4: Test the Dashboard Endpoint
```bash
export ADMIN_TOKEN="your-access-token-here"

curl -X GET http://localhost:3000/admin/analytics/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Expected response:
```json
{
  "totalUsers": 1250,
  "activeUsers": 450,
  "totalGames": 3200,
  "totalGamePlayers": 8500
}
```

### Step 5: Test Individual Endpoints

```bash
# Total Users
curl -X GET http://localhost:3000/admin/analytics/users/total \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Active Users (last 30 days)
curl -X GET http://localhost:3000/admin/analytics/users/active \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Total Games
curl -X GET http://localhost:3000/admin/analytics/games/total \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Total Game Players
curl -X GET http://localhost:3000/admin/analytics/games/players/total \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## ✅ Verification Checklist

- [ ] Backend server is running
- [ ] Admin user exists with `is_admin: true`
- [ ] JWT token obtained successfully
- [ ] Dashboard endpoint returns data
- [ ] All individual endpoints return data
- [ ] Non-admin users get 403 Forbidden
- [ ] Requests without token get 401 Unauthorized

## 🔧 Troubleshooting

### Issue: 401 Unauthorized
**Solution**: Make sure you're including the Authorization header with a valid JWT token.

### Issue: 403 Forbidden
**Solution**: Verify the user has `is_admin: true` in the database:
```sql
SELECT id, email, is_admin FROM users WHERE email = 'your-email@example.com';
```

If not, update it:
```sql
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

### Issue: Module not found
**Solution**: Ensure the module is imported in `app.module.ts` and restart the server.

### Issue: Database connection error
**Solution**: Check your database configuration in `.env` file.

## 📊 Understanding the Metrics

### Total Users
All registered users in the system, regardless of activity status.

### Active Users
Users who have been active in the last 30 days. A user is considered active if their `updated_at` timestamp is within the last 30 days. This includes:
- Login activity
- Game participation
- Profile updates
- Any account modifications

### Total Games
All games created in the system, including:
- Pending games (waiting for players)
- Active games (in progress)
- Completed games
- Cancelled games

### Total Game Players
Total number of player participations across all games. If a user plays 5 games, they contribute 5 to this count. This metric helps understand:
- Overall game engagement
- Average players per game (totalGamePlayers / totalGames)
- User participation rate

## 🎯 Common Use Cases

### 1. Dashboard Overview
Use the `/dashboard` endpoint to get all metrics at once for your admin dashboard homepage.

### 2. User Growth Tracking
Call `/users/total` periodically and store the results to track user growth over time.

### 3. Engagement Monitoring
Compare `/users/active` vs `/users/total` to calculate engagement rate:
```
Engagement Rate = (activeUsers / totalUsers) * 100
```

### 4. Game Activity Analysis
Use `/games/total` and `/games/players/total` to calculate average players per game:
```
Avg Players Per Game = totalGamePlayers / totalGames
```

## 🔐 Security Best Practices

1. **Never expose admin tokens**: Store them securely, never commit to version control
2. **Use HTTPS in production**: Always use encrypted connections
3. **Rotate tokens regularly**: Implement token refresh mechanisms
4. **Monitor access logs**: Track who accesses admin endpoints
5. **Rate limiting**: The endpoints are already protected by ThrottlerGuard

## 📈 Next Steps

1. **Integrate with Frontend**: Create admin dashboard UI components
2. **Add Caching**: Implement Redis caching for frequently accessed metrics
3. **Set up Monitoring**: Add alerts for unusual metric changes
4. **Historical Tracking**: Store metrics over time for trend analysis
5. **Export Functionality**: Add CSV/Excel export capabilities

## 📚 Additional Resources

- [Full Documentation](./README.md)
- [API Testing Guide](./TESTING.md)
- [Architecture Diagram](./ARCHITECTURE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

## 💡 Tips

- Use the dashboard endpoint for real-time displays
- Use individual endpoints when you only need specific metrics
- Cache results on the frontend to reduce API calls
- Consider implementing WebSocket for real-time updates
- Add date range filters for more granular analytics

## 🆘 Need Help?

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the logs: `tail -f backend/logs/app.log`
3. Verify database connectivity
4. Ensure all dependencies are installed
5. Check that migrations are up to date

---

**You're all set!** 🎉 The admin analytics endpoints are ready to use.
