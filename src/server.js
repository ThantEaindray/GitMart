const path = require('path');
const dotenv = require('dotenv');
// Load .env.dev normally, and .env.test only when NODE_ENV is test
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.dev';

dotenv.config({
  path: path.join(__dirname, '..', envFile),
});

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log(`Loaded environment file: ${envFile}`);
});


const { WebSocketServer } = require('ws')
// Use a safer default during tests so Playwright does not collide with port 443.
const DEFAULT_WS_PORT = process.env.NODE_ENV === 'test' ? 3443 : 443;
const WS_PORT = process.env.WS_PORT || DEFAULT_WS_PORT;
const webS = new WebSocketServer({ port: WS_PORT })

//now we tell it what to do upon a new connection
webS.on('connection', ws => {
  console.log('new client connected')
  ws.on('close', () => console.log('client disconnected'))
  ws.on('message', data => {
    webS.clients.forEach(client => {
      client.send(JSON.stringify(data))
    })
  })
  ws.onerror = function () {
    console.log("ws error")
  }
})
