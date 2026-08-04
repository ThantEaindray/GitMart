let token = localStorage.getItem('token')
let openChat = localStorage.getItem('openChat')
let webSocket = new WebSocket(`ws://${location.hostname}:3001`)
console.log(webSocket.url)
localStorage.setItem('webSocket', webSocket)

//so we need to set it up to send over some info about the user on the initial websocket connection
webSocket.onopen = () => {
  console.log("ws opened")
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
  console.log("new ws content incoming", JSON.parse(event.data))
  let data = JSON.parse(event.data)
  if (data.type = "message") {
    if (data.to == uId || data.from == uId) {
      //we need to do basically what we did on the history loading part should be easy enough
    var side = (data.from == uId) ? 'sent' : 'received';
      //so now that we have the positioning we wanna check that its sent to the intended chat
      if (data.chat == openChat) {
        //the part which is gonna call the image functions 
        if (data.cont_type === "img") {
          document.getElementById('messages').innerHTML += `
            <div class="msg ${side}">
              <img class="msg-img" src="${data.cont}"/>
            </div>
          `
        } else {
          //if cont type isnt image then it has to be text
          document.getElementById('messages').innerHTML += `
            <div class="msg ${side}">
              <span class="msg-bubble">${data.cont}</span>
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

function sendTxt(content) {
  let cont = {
      type: "message",
      chat: openChat,
      from: uId,
      to: localStorage.getItem("with"),
      cont_type: "txt",
      cont: content
    }
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
      console.log("success")
    } else {
      //if its not a 201, its gotta be an error so we just hit it whith the classic standard browser alert box :P
      alert("error sending message, please try again later.")
    }
  }, "POST", cont, token)
}

