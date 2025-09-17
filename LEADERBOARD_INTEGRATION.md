# Live Leaderboard Integration for Nadmetry Dash

This document explains how the live leaderboard integration with MonadClip works in your game.

## Implementation Overview

The leaderboard now fetches real-time data from the MonadClip API instead of using hardcoded values. The implementation follows the pattern provided by your friend, with enhancements specific to your game.

## Key Features

1. **Real-time Data**: Fetches live leaderboard data from MonadClip API
2. **CORS Handling**: Uses `api.allorigins.win` to bypass CORS restrictions
3. **Auto-refresh**: Updates every 30 seconds
4. **Player Highlighting**: Highlights the current player in the leaderboard
5. **Error Handling**: Gracefully handles API errors and missing data
6. **Responsive Design**: Maintains the existing UI/UX
7. **Top 5 Players**: Shows only the top 5 players as per your requirements

## Technical Details

### API Endpoint

The leaderboard fetches data from:
```
https://www.monadclip.fun/api/leaderboard?gameId=7&sortBy=scores
```

This uses game ID 7 and sorts by scores as specified in your instructions.

### Data Structure

The API returns data in this format:
```json
{
  "data": [
    {
      "walletAddress": "0x...",
      "username": "player_name",
      "score": 1500,
      "timestamp": 1234567890
    }
  ]
}
```

### Implementation Files

The implementation is in `app/components/Dash.tsx` in the `LeaderboardManager` class and `LeaderboardSidebar` component.

## How It Works

1. **Data Fetching**: 
   - The `LeaderboardManager` class handles API communication
   - Uses `api.allorigins.win` to bypass CORS
   - Fetches data every 30 seconds via `setInterval`

2. **Data Processing**:
   - Validates and parses score data
   - Sorts entries by score (descending)
   - Limits to top 10 players

3. **UI Display**:
   - Shows player's current score and rank
   - Highlights the current player in the list
   - Displays medals for top 3 players (🥇🥈🥉)
   - Shows loading and error states

## Customization Options

You can easily customize the leaderboard by modifying:

1. **Refresh Interval**: Change the `30000` ms value in `setInterval`
2. **Entry Limit**: Modify the `10` in `getTopScores(10)`
3. **Styling**: Adjust the CSS classes in the JSX
4. **Game ID**: Update the gameId parameter if needed

## Troubleshooting

If the leaderboard isn't showing data:

1. **Check Network**: Verify the API endpoint is accessible
2. **CORS Issues**: Ensure `api.allorigins.win` is working
3. **Game ID**: Confirm the gameId matches your MonadClip game
4. **Console Errors**: Check browser console for specific error messages

## Future Enhancements

Possible improvements include:
- Adding pagination for more players
- Implementing search/filter functionality
- Adding player avatars
- Showing score history/trends
- Adding social sharing features