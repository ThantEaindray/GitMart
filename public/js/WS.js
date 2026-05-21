//so this one will solely be for handling websocket stuff since the chats page will probably end up a bit too chaotic if i let it have everything in there
const token = localStorage.getItem(token)
const uId = localStorage.getItem(loggedInUserId)
const openChat = localStorage.getItem(openChat)
const webSocket = new WebSocket('ws://localhost:443/');

webSocket.onmessage = (event) => {
  console.log(event)
  //so the event is the message content basically, in this case itll be an object with a recipient
  //so we need to unwrap it first and determine if its for our user 
  if (event.data.chatId !== openChat) {
    return
  }
  //now that we can be sure that its for our user here (security be damned im doing this rough and fast)
  //ok so theres 2 types of messages, images and text. obviously theyll need to be displayed differently
  if (event.data.textcontent !== undefined)
  document.getElementById("messages").innerHTML += `
    <div class="row">
      <div class="col-3">
        <div class="card">
        
        </div>
      </div>
    </div>
  `
}