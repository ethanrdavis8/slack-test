# Slack Channel Search Test

A simple test application to verify Slack channel search functionality.

## Features

- 🔍 **Real-time search** through Slack channels
- 📋 **Channel details** showing ID, privacy, member count
- ✅ **Channel selection** with visual feedback
- 🎨 **Clean UI** with Slack branding

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables (required):
   ```bash
   export SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
   ```

3. Run the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 in your browser

## API Endpoints

- `GET /` - Main search interface
- `GET /api/slack-channels` - Fetch all Slack channels
- `GET /health` - Health check

## Deployment

This app is designed to be deployed to Railway:

1. Connect your GitHub repository to Railway
2. Set the `SLACK_BOT_TOKEN` environment variable
3. Deploy automatically

## Testing

The app provides detailed console logging to help debug any issues with:
- Channel loading from Slack API
- Search functionality
- Channel selection

Open the browser developer console to see detailed logs.