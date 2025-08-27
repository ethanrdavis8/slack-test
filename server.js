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
      // Temporarily hardcode for testing
      const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
      const botToken = process.env.SLACK_BOT_TOKEN || tokenParts.join('-');
      
      console.log('Using bot token:', botToken.substring(0, 15) + '...');
      
      console.log('Fetching Slack channels...');
      
      const response = await axios.get('https://slack.com/api/conversations.list', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        },
        params: {
          types: 'public_channel,private_channel',
          limit: 100,
          exclude_archived: false
        }
      });
      
      console.log('Full Slack API Response:', JSON.stringify(response.data, null, 2));
      
      if (response.data.ok) {
        console.log('Raw channels from API:', response.data.channels);
        console.log('Number of raw channels:', response.data.channels ? response.data.channels.length : 'undefined');
        
        const channels = response.data.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          is_private: channel.is_private,
          is_archived: channel.is_archived,
          num_members: channel.num_members
        }));
        
        console.log(`Processed ${channels.length} channels:`, channels);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(channels));
      } else {
        console.error('Slack API Error:', response.data.error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Failed to fetch Slack channels',
          details: response.data.error 
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
      // Temporarily hardcode for testing
      const tokenParts = ['xoxb-5847669636770', '9414093384181', 'nSsENtbXr9dWvBP0L7StVcKY'];
      const botToken = process.env.SLACK_BOT_TOKEN || tokenParts.join('-');
      
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Debug endpoint working',
      method: req.method,
      pathname: parsedUrl.pathname,
      botTokenSet: !!process.env.SLACK_BOT_TOKEN,
      botTokenPrefix: process.env.SLACK_BOT_TOKEN ? process.env.SLACK_BOT_TOKEN.substring(0, 10) : 'not set'
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