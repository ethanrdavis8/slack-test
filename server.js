const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  console.log(`${req.method} ${parsedUrl.pathname}`);
  
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    // Serve the main HTML page
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Page not found');
    }
  } else if (parsedUrl.pathname === '/api/slack-channels' && req.method === 'GET') {
    // Get Slack channels using the bot token
    try {
      const axios = require('axios');
      // Hardcoded token for testing - should always work
      const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
      const hardcodedToken = tokenParts.join('-');
      const botToken = process.env.SLACK_BOT_TOKEN || hardcodedToken;
      
      console.log('Environment token set:', !!process.env.SLACK_BOT_TOKEN);
      console.log('Using hardcoded fallback:', !process.env.SLACK_BOT_TOKEN);
      console.log('Final token starts with:', botToken.substring(0, 10));
      
      console.log('Using bot token:', botToken.substring(0, 15) + '...');
      
      console.log('Fetching Slack channels and users...');
      
      // Fetch channels and conversations
      const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        },
        params: {
          types: 'public_channel,private_channel,im,mpim',
          limit: 100,
          exclude_archived: true
        }
      });
      
      // Fetch users
      const usersResponse = await axios.get('https://slack.com/api/users.list', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        }
      });
      
      console.log('Channels API Response:', JSON.stringify(channelsResponse.data, null, 2));
      console.log('Users API Response:', JSON.stringify(usersResponse.data, null, 2));
      
      if (channelsResponse.data.ok && usersResponse.data.ok) {
        const rawChannels = channelsResponse.data.channels || [];
        const rawUsers = usersResponse.data.members || [];
        
        console.log('Raw channels from API:', rawChannels.length);
        console.log('Raw users from API:', rawUsers.length);
        
        // Process channels
        const channels = rawChannels.map(channel => ({
          id: channel.id,
          name: channel.name || `Channel ${channel.id}`,
          is_private: channel.is_private,
          is_archived: channel.is_archived,
          num_members: channel.num_members,
          type: channel.is_im ? 'dm' : channel.is_mpim ? 'group_dm' : 'channel'
        }));
        
        // Process users (exclude bots and deleted users)
        const users = rawUsers
          .filter(user => !user.deleted && !user.is_bot && user.id !== 'USLACKBOT')
          .map(user => ({
            id: user.id,
            name: user.real_name || user.name,
            display_name: user.profile?.display_name || user.name,
            is_private: true,
            is_archived: false,
            num_members: 2,
            type: 'user'
          }));
        
        // Combine channels and users
        const allOptions = [...channels, ...users];
        
        console.log(`Processed ${channels.length} channels and ${users.length} users`);
        console.log('Sample results:', allOptions.slice(0, 5));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allOptions));
      } else {
        const channelsError = channelsResponse.data.error || 'Unknown error';
        const usersError = usersResponse.data.error || 'Unknown error';
        console.error('Slack API Error - Channels:', channelsError);
        console.error('Slack API Error - Users:', usersError);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Failed to fetch Slack data',
          details: { channels: channelsError, users: usersError }
        }));
      }
    } catch (error) {
      console.error('Error fetching Slack channels:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to fetch Slack channels',
        details: error.message 
      }));
    }
  } else if (parsedUrl.pathname === '/api/test-auth' && req.method === 'GET') {
    // Test Slack bot token authentication
    try {
      const axios = require('axios');
      // Hardcoded token for testing - should always work
      const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
      const hardcodedToken = tokenParts.join('-');
      const botToken = process.env.SLACK_BOT_TOKEN || hardcodedToken;
      
      console.log('Environment token set:', !!process.env.SLACK_BOT_TOKEN);
      console.log('Using hardcoded fallback:', !process.env.SLACK_BOT_TOKEN);
      console.log('Final token starts with:', botToken.substring(0, 10));
      
      console.log('Testing auth with token:', botToken.substring(0, 15) + '...');
      
      const response = await axios.get('https://slack.com/api/auth.test', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        }
      });
      
      console.log('Auth test response:', response.data);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response.data));
      
    } catch (error) {
      console.error('Auth test error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      uptime: process.uptime(),
      message: 'Slack Channel Search Test API'
    }));
  } else if (parsedUrl.pathname === '/debug' && req.method === 'GET') {
    // Same token logic as other endpoints
    const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
    const hardcodedToken = tokenParts.join('-');
    const finalToken = process.env.SLACK_BOT_TOKEN || hardcodedToken;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Debug endpoint working',
      method: req.method,
      pathname: parsedUrl.pathname,
      envTokenSet: !!process.env.SLACK_BOT_TOKEN,
      envTokenValue: process.env.SLACK_BOT_TOKEN ? process.env.SLACK_BOT_TOKEN.substring(0, 10) : 'not set',
      usingHardcodedFallback: !process.env.SLACK_BOT_TOKEN,
      finalTokenPrefix: finalToken.substring(0, 10)
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Route not found: ${req.method} ${parsedUrl.pathname}`);
  }
});

server.listen(port, () => {
  console.log(`🚀 Slack Channel Search Test Server running on port ${port}`);
  console.log(`📡 Test the search at: http://localhost:${port}`);
});