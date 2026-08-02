var uId = localStorage.getItem('loggedInUserId');
function loadChat(data) {
  document.getElementById('messages').innerHTML = '';
  data.forEach(function (e) {
    var side = (e.sender_id == uId) ? 'sent' : 'received';
    if (e.textcontent !== undefined) {
      document.getElementById('messages').innerHTML += `
        <div class="msg ${side}">
          <span class="msg-bubble">${e.textcontent}</span>
        </div>
      `;
    } else {
      document.getElementById('messages').innerHTML += `
        <div class="msg ${side}">
          <img class="msg-img" src="${e.imagecontent}" />
        </div>
      `
    }
  });
  var el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function viewChat(cId) {
  //ok so we need to get the stuff from one specific chat now
  // so the chat id will be pulled from the request in the function and then we get the users id from inside of the thing itself
  //we also wanna pass the chat id into the localStorage for future use
  localStorage.setItem('openChat', cId)
  document.getElementById('chatwith').innerHTML = `<h2>Now Chatting</h2>`;
  fetchMethod(`/api/chats/viewChat/${cId}`, (stat, data) => {
    if (stat == 200) {
      loadChat(data)
    } else if (stat == 401 || stat == 403) {
      window.location.href = ('./login.html')
    }
  }, "GET")
}

//so we need to get the users chats
function renderChats(results) {
  //this will assemble everything into its bits of info with the functions to call to load their individual chats as well
  //in a perfect world itd be async but time
  results.forEach(function (e) {
    document.getElementById('chats').innerHTML += `
      <div class="chat-item" id="chat-${e.chat}" onclick="viewChat(${e.chat},${e.toId})">
        <i class="bi bi-person-circle chat-item-icon"></i>
        <span class="chat-item-name">${e.username}</span>
      </div>
    `;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  //immediately load the webSocket before we do anything else and store it locally for future use
  const webSocket = new WebSocket(`ws://${location.hostname}:3001/`)
  localStorage.setItem(webSocket, webSocket)
  //so first things first we need to do the most basic of calling the api to get the users chats to load in, first things first\
  //check for a logged in user
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.href = "./login.html"
    return
  }

  document.getElementById('input-form').addEventListener('submit', (event) => {
    event.preventDefault()
    sendTxt(document.getElementById('message').value)
  })

  fetchMethod("/api/chats", (stat, data) => {
    if (stat == 200) {
      renderChats(data)
    } else if (stat == 401) {
      window.location.href = ('./login.html')
      console.error("problem loading chat list")
    }
  }, "GET", null, token)
  //and now we wanna make the part where it loads a specific chat based on what someone presses

})
