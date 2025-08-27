const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

// Simple cache to avoid rate limits
let cachedData = null;
let cacheExpiry = 0;
const CACHE_DURATION = 60000; // 1 minute cache

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
  } else if (parsedUrl.pathname === '/scheduler' && req.method === 'GET') {
    // Serve the message scheduler HTML page
    try {
      const html = fs.readFileSync(path.join(__dirname, 'message-scheduler.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Scheduler page not found');
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
      
      // Check cache first
      const now = Date.now();
      if (cachedData && now < cacheExpiry) {
        console.log('Returning cached data to avoid rate limits');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cachedData));
        return;
      }
      
      console.log('Cache expired or empty, fetching fresh data...');
      
      // Fetch ALL channels with pagination
      let allChannels = [];
      let cursor = '';
      let hasMore = true;
      
      console.log('Fetching all channels with pagination...');
      
      while (hasMore) {
        const params = {
          types: 'public_channel,private_channel,im,mpim',
          limit: 200, // Max allowed by Slack
          exclude_archived: true
        };
        
        if (cursor) {
          params.cursor = cursor;
        }
        
        const channelsResponse = await axios.get('https://slack.com/api/conversations.list', {
          headers: {
            'Authorization': `Bearer ${botToken}`
          },
          params: params
        });
        
        if (channelsResponse.data.ok) {
          allChannels = [...allChannels, ...(channelsResponse.data.channels || [])];
          cursor = channelsResponse.data.response_metadata?.next_cursor || '';
          hasMore = !!cursor;
          console.log(`Fetched ${channelsResponse.data.channels.length} channels, total so far: ${allChannels.length}`);
        } else {
          hasMore = false;
          console.error('Error fetching channels:', channelsResponse.data.error);
        }
      }
      
      console.log(`Total channels fetched: ${allChannels.length}`);
      
      // Fetch users
      const usersResponse = await axios.get('https://slack.com/api/users.list', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        }
      });
      
      console.log('Users API Response:', JSON.stringify(usersResponse.data, null, 2));
      
      if (allChannels.length > 0 && usersResponse.data.ok) {
        const rawChannels = allChannels;
        const rawUsers = usersResponse.data.members || [];
        
        console.log('Raw channels from API:', rawChannels.length);
        console.log('Raw users from API:', rawUsers.length);
        
        // Debug private channels specifically
        const privateChannels = rawChannels.filter(c => c.is_private && !c.is_im && !c.is_mpim);
        const publicChannels = rawChannels.filter(c => !c.is_private && !c.is_im && !c.is_mpim);
        const dms = rawChannels.filter(c => c.is_im);
        const groupDms = rawChannels.filter(c => c.is_mpim);
        
        console.log(`Channel breakdown:`);
        console.log(`  - Public channels: ${publicChannels.length}`);
        console.log(`  - Private channels: ${privateChannels.length}`);
        console.log(`  - Direct messages: ${dms.length}`);
        console.log(`  - Group DMs: ${groupDms.length}`);
        console.log('Private channel names:', privateChannels.map(c => c.name));
        
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
        
        // Cache the results
        cachedData = allOptions;
        cacheExpiry = Date.now() + CACHE_DURATION;
        console.log(`Data cached until: ${new Date(cacheExpiry).toLocaleTimeString()}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allOptions));
      } else {
        const channelsError = allChannels.length === 0 ? 'Failed to fetch channels' : 'OK';
        const usersError = usersResponse.data?.error || 'Unknown error';
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
  } else if (parsedUrl.pathname === '/api/send-test-message' && req.method === 'POST') {
    // Send test message to selected channels
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { message, channels } = JSON.parse(body);
        
        if (!message || !channels || channels.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing message or channels' }));
          return;
        }
        
        // Get bot token
        const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
        const hardcodedToken = tokenParts.join('-');
        const botToken = process.env.SLACK_BOT_TOKEN || hardcodedToken;
        
        console.log(`Sending test message "${message}" to ${channels.length} channels`);
        
        const results = [];
        const axios = require('axios');
        
        // Send message to each channel
        for (const channelId of channels) {
          try {
            const response = await axios.post('https://slack.com/api/chat.postMessage', {
              channel: channelId,
              text: `🧪 ${message}\n\nSent at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT\n\nThis is a test message from the Slack Message Scheduler.`,
              username: 'Message Scheduler Test'
            }, {
              headers: {
                'Authorization': `Bearer ${botToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.data.ok) {
              console.log(`✅ Sent to channel ${channelId}`);
              results.push({ channelId, success: true });
            } else {
              console.error(`❌ Failed to send to ${channelId}: ${response.data.error}`);
              results.push({ channelId, success: false, error: response.data.error });
            }
          } catch (error) {
            console.error(`❌ Error sending to ${channelId}: ${error.message}`);
            results.push({ channelId, success: false, error: error.message });
          }
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`Message sending complete: ${successful} successful, ${failed} failed`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Test message sent',
          results: results,
          summary: {
            successful,
            failed,
            total: channels.length
          }
        }));
        
      } catch (error) {
        console.error('Error sending test message:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to send test message' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Route not found: ${req.method} ${parsedUrl.pathname}`);
  }
});

server.listen(port, () => {
  console.log(`🚀 Slack Channel Search Test Server running on port ${port}`);
  console.log(`📡 Test the search at: http://localhost:${port}`);
});