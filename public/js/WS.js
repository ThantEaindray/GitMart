//so this one will solely be for handling websocket stuff since the chats page will probably end up a bit too chaotic if i let it have everything in there
const token = localStorage.getItem('token')
const uId = localStorage.getItem('loggedInUserId')
let openChat = localStorage.getItem('openChat')
const webSocket = localStorage.getItem('webSocket');
const images = require ('./images')

//so we need to set it up to send over some info about the user on the initial websocket connection
webSocket.onopen = () => {
  //now we need to send over an initial handshake message to let the socket know what to do with it
  //alright so we want to send our initial handshake now
  let data = {
    type: 'handshake',
    id: uId,
    token: token
  }
  //no need to write it to the data since it isnt really relevant to that.
  webSocket.send(JSON.stringify(data))
}

webSocket.onmessage = (event) => {
  //so the event is the message content basically, in this case itll be an object with a recipient
  //so we need to unwrap it first and determine if its for our user
  //we need to deserialise it since the WS only accepts JSON
  
  let data = JSON.parse(String.fromCharCode.apply(null, event.data))

  if (data.type = "message") {
    if (data.to == uId || data.from == uId) {
      //we need to do basically what we did on the history loading part should be easy enough
    var side = (e.from == uId) ? 'sent' : 'received';
      //so now that we have the positioning we wanna check that its sent to the intended chat
      if (data.chat == openChat) {
        //the part which is gonna call the image functions 
        if (data.cont_type === "img") {
          document.getElementById('messages').innerHTML += `
            <div class="msg ${side}">
              <img class="msg-img" src="${e.cont}"/>
            </div>
          `
        } else {
          //if cont type isnt image then it has to be text
          document.getElementById('messages').innerHTML += `
            <div class="msg ${side}">
              <span class="msg-bubble">${e.cont}</span>
            </div>
          `;
        }
      } else {
        //for future use this is where we'll put the function that shows your unread chat messages
      }
    }
  }
}
    //so what do we need to do when the user wants to send a message (lets just get text working first and then we can sort out the images later)
    // this is gonna be horribly painful to do isnt it

function sendTxt(content, toId) {
  let cont = {
      type: "message",
      chat: openChat,
      from: uId,
      to: toId,
      cont_type: "txt",
      cont: content
    }
  localStorage.setItem('toId', toId)
  //this will help us later snater
  document.getElementById('message').value = ''
  //just a barebones bit of verification to make sure things dont break down
  if (content == undefined) {
    return
  }
  //we need to write it into the message log
  fetchMethod("/api/chats/send", (stat, data) => {
    if (stat == 201) {
      //and we need to send it to the websocket only if it sucessfully stores the data in the db
      webSocket.send(JSON.stringify(cont))
    } else {
      //if its not a 201, its gotta be an error so we just hit it whith the classic standard browser alert box :P
      alert("error sending message, please try again later.")
    }
  }, "POST", cont, token)
}

