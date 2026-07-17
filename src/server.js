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
const WS_PORT = process.env.WS_PORT || 443;
const ws = new WebSocketServer({ port: WS_PORT })
let connections = new Array
//array which holds the list of connections to the socket so we know which one is which to send messages to them
//now we tell it what to do upon a new connection

//alright lets get this started how do we make the websockets work as intended
//ok so theres 3 types of websocket messages we can get
// handshake, content, info, disconnects
// info gets sent out by the server the server recieves the other 3
ws.on('message', (data) => {
  //alright so we'll need to narrow it down into the 3 different kinds now
  let parsed = String.fromCharCode.apply(null, data.data)
  let conn = data.origin
  //alright now theres 3 ways for it to go
  if (parsed.type = 'handshake') {
    //so here we need to make the fn for sending out info regarding the initial handshake
    connections.push({ id: parsed.id, conn: conn })
    ws.clients.forEach(cli => {
      //this part isnt as useful just yet but this is the groundwork for the online indicators.
      cli.send(
        JSON.stringify({
          type: "info",
          inftype: "newConn",
          id:parsed.id
        })
      )
    })
  }
  //now we need to handle the messages if its an actual message
  if (parsed.type = "message") {
    var sendto
    //we make a simple sendto variable and that will hold the conn id for our user we're targeting
    // (keep it here for scoping)
    function send() {
      //this will do the actual sending then the foreach determines if the user is online to be sent to
      ws.clients.forEach(cli => {
        
      })
    }
    connections.forEach(e => {
      if (e.id = parsed.toUsr) {
        sendto = e.conn
        send()
      } else {
        //if theyre not online (not in the list of connections) we just return
        return
      }
    })

  }
})
