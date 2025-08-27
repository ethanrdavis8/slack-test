const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
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
      const botToken = process.env.SLACK_BOT_TOKEN;
      
      if (!botToken) {
        console.error('SLACK_BOT_TOKEN environment variable is required');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'SLACK_BOT_TOKEN environment variable not configured',
          details: 'Please set the SLACK_BOT_TOKEN environment variable in Railway'
        }));
        return;
      }
      
      console.log('Fetching Slack channels...');
      
      const response = await axios.get('https://slack.com/api/conversations.list', {
        headers: {
          'Authorization': `Bearer ${botToken}`
        },
        params: {
          types: 'public_channel,private_channel',
          limit: 100
        }
      });
      
      console.log('Slack API Response:', response.data);
      
      if (response.data.ok) {
        const channels = response.data.channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          is_private: channel.is_private,
          is_archived: channel.is_archived,
          num_members: channel.num_members
        }));
        
        console.log(`Found ${channels.length} channels`);
        
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
  } else if (parsedUrl.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      uptime: process.uptime(),
      message: 'Slack Channel Search Test API'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`🚀 Slack Channel Search Test Server running on port ${port}`);
  console.log(`📡 Test the search at: http://localhost:${port}`);
});