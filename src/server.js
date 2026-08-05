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

const { WebSocketServer } = require('ws');
const WS_PORT = process.env.WS_PORT || 3001;
const ws = new WebSocketServer({ port: WS_PORT });
let connections = new Array();
//array which holds the list of connections to the socket so we know which one is which to send messages to them
//now we tell it what to do upon a new connection
ws.on('connection', (cli) => {
  console.log('new ws connection');
});
//alright lets get this started how do we make the websockets work as intended
//ok so theres 3 types of websocket messages we can get
// handshake, content, info, disconnects
// info gets sent out by the server the server recieves the other 3
// so in theory this whole part will be unused at least for this portion of the code its for a planned feature
ws.on('message', (data) => {
  console.log('new incoming', data);
  //in theory this one wont really matter as much since we're instead doing direct calls from within the system to make the ws work since apparently thats what needs to be done
  //alright so we'll need to narrow it down into the 3 different kinds now
  let parsed = JSON.parse(String.fromCharCode.apply(null, data.data));
  let conn = data.origin;
  //alright now theres 3 ways for it to go
  if (parsed.type == 'handshake') {
    //so here we need to make the fn for sending out info regarding the initial handshake
    connections.push({ id: parsed.id, conn: conn });
    ws.clients.forEach((cli) => {
      //this part isnt as useful just yet but this is the groundwork for the online indicators.
      cli.send(
        JSON.stringify({
          type: 'info',
          inftype: 'Conns',
          allcons: connections,
        }),
      );
    });
  }
});
ws.on('close', (cli) => {
  let toclose = connections.find((e) => e.conn == cli.origin);
  //now we need to get the index of the array element so that we can get rid of it
  let closeIndex = connections.indexOf(toclose);
  if (closeIndex > -1) {
    connections.splice(closeIndex, 1);
  }
  ws.connections.forEach((cli) => {
    cli.send(
      JSON.stringify({
        type: 'info',
        inftype: 'Conns',
        allcons: connections,
      }),
    );
  });
});

//so we also need a module that will handle sending the image data which has to be here since it just does

module.exports.send = (data) => {
  console.log('sending', data);
  ws.clients.forEach((cli) => {
    cli.send(JSON.stringify(data));
  });
};

//so now we get the info cons inftype with the array of all the connections to the system
// thats the backend logic for the online offline indicators its not pretty but it works
