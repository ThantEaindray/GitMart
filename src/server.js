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
const WS_PORT = process.env.WS_PORT || 443;
const ws = new WebSocketServer({ port: WS_PORT })
let connections = new Array
//array which holds the list of connections to the socket so we know which one is which to send messages to them
//now we tell it what to do upon a new connection
<<<<<<< HEAD
webS.on('connection', ws => {
  console.log('new client connected')
  ws.on('open', handshake => {
    let parsed = JSON.parse(String.fromCharCode.apply(null,handshake.data))
    console.log('user connected:', parsed)
    //so now that we have the connected users info, we want to have it push that into the array
    connections.push({ id: parsed.id, conn: request.origin })
    //announce to all the connected clients that a new user has connected to the system for online ofline tagging
    webS.clients.forEach(client => {
      client.send({
        type: newUsr,
        id: parsed.id
      })
    })
  })
  ws.on('close', () => console.log('client disconnected'))
  ws.on('message', data => {
    webS.clients.forEach(client => {
<<<<<<< HEAD
=======
      //on recieving a message we need to check the type, if the type is a message then we proceed to send it out otherwise we do nothing with it
      let content = JSON.parse(String.fromCharCode.apply(null, data))
      if (content.type = 'msg') {
        console.log('new message:', content)
        //so now that weve determined its a message we now need to send the message to that specific user ids client based on the array
        //find the users connection from the list 
        let connection = connections(e => {
          e.id==content.user
        })
      }
      console.log(`new message:`, JSON.parse(data))
>>>>>>> b5bc1c5 (started on the WS rewrite needed to make it support actual peer to peer messaging and not sprint 1 jank)
      client.send(JSON.stringify(data))
=======

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
>>>>>>> e6e783c (fixed a few flaws in my code, the rewrite continues)
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
