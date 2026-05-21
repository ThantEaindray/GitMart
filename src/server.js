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
//so from what i understand app is basically just express but renamed
// this is the scary part everyone pray i dont break the entire server
const { WebSocketServer } = require('ws')
const webS= new WebSocketServer({port:443})

//now we tell it what to do upon a new connection
webS.on('connection', ws => {
  console.log('new client connected')
  ws.send("connection established")
  ws.on('close', () => console.log('client disconnected'))
  ws.on('message', data => {
    webS.clients.forEach(client => {
      console.log(`new message: ${data}`)
    })
  })
  ws.onerror = function () {
    console.log("ws error")
  }
})
