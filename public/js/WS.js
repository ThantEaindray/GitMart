//so this one will solely be for handling websocket stuff since the chats page will probably end up a bit too chaotic if i let it have everything in there
const token = localStorage.getItem('token')
const uId = localStorage.getItem('loggedInUserId')
const webSocket = new WebSocket('ws://localhost:443/');

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
      let position = "justify-content-end"
      let cardcolour = "text-bg-success"
      //this is if were the sender
      if (data.from !== uId) {
        position = "justify-content-start"
        cardcolour = "text-bg-secondary text-end"
      }
      //so now that we have the positioning we wanna check that its sent to the intended chat
      if (data.chat == openChat) {
        if (content.textcontent !== undefined)
          document.getElementById("messages").innerHTML += `
            <div class="row p-2 ${position}">
              <div class="col-4">
                <div class="card p-2 ${cardcolour}" >
                  <p class="p-1">${data.content}</p>
                </div>
              </div>
            </div>
          `
      }
    }
    //ok so we need to do the setup for the unread flag here
    if (data.to == uId && data.chat !== openChat) {
      //unread chat fn goes here
    }
  }
  if (data.type == "info") {
    //so we need to get the info here which is just the connections so we just have to get it to like innerhtml and stuff 
    if (data.inftype == "Conns") {
      
    }
  }
}
//so what do we need to do when the user wants to send a message (lets just get text working first and then we can sort out the images later)
// this is gonna be horribly painful to do isnt it

function sendTxt(content) { 
  let openChat = localStorage.getItem('openChat')
  let cont = {
    type:"message",
    chat: openChat,
    from: uId,
    to: , 
    textcontent: content
  }
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
