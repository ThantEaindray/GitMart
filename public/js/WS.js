//so this one will solely be for handling websocket stuff since the chats page will probably end up a bit too chaotic if i let it have everything in there
const token = localStorage.getItem(token)
const uId = localStorage.getItem(loggedInUserId)
const openChat = localStorage.getItem(openChat)
const webSocket = new WebSocket('ws://localhost:443/');

webSocket.onmessage = (event) => {
  console.log(event)
  //so the event is the message content basically, in this case itll be an object with a recipient
  //so we need to unwrap it first and determine if its for our user 
  //we need to deserialise it since the WS only accepts JSON
  let content = JSON.parse(event.data)
  if (content.chat !== openChat) {
    return
  }
  //now that we can be sure that its for our user here (security be damned im doing this rough and fast)
  //either our user or they sent it i think it will still broadcast to everyone regardless of if they sent it
  //ok so theres 2 types of messages, images and text. obviously theyll need to be displayed differently

  //we need to do basically what we did on the history loading part should be easy enough
  let position = "align-self-end"
  //this is if were the sender
  if (content.user !== uId) {
    position ="align-self-start"
  }
  
  if (content.textcontent !== undefined)
  document.getElementById("messages").innerHTML += `
    <div class="row">
      <div class="col-3 ${position}">
        <div class="card">
          <p>${content.textcontent}</p>
        </div>
      </div>
    </div>
  `
  
}

//so what do we need to do when the user wants to send a message (lets just get text working first and then we can sort out the images later)
// this is gonna be horribly painful to do isnt it

function sendTxt(content) { 
  let cont = {
    chat: openChat,
    user: uId,
    textcontent: content
  }
  
  //just a barebones bit of verification to make sure things dont break down
  if (content == undefined) {
    return
  }
  //we need to write it into the message log
  fetchmethod("/api/chats/send", (stat, data) => {
    if (stat == 201) {
      //and we need to send it to the websocket only if it sucessfully stores the data in the db
      webSocket.send(JSON.stringify(cont))
    } else {
      //if its not a 201, its gotta be an error so we just hit it whith the classic standard browser alert box :P
      alert("error sending message, please try again later.")
    }
  })


  
}
