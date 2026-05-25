function loadChat(data) {
  //so for this all we need to do is read the incoming data and then 
  // check which user for L/R positioning
  // we also wanna clear out the last chats info so it dosent double itself up
  document.getElementById('messages').innerHTML = ``
  data.forEach((e) => {
    let position = new String
    if (e.sender_id == uId) {
      position = "justify-content-end"
      textPos="text-bg-success"
    } else {
      position = "justify-content-start"
      textPos="text-end text-bg-secondary"
    }
    //now that we have the positions its just a matter of copying over the card and stuff 
    if (e.textcontent !== undefined) {
      document.getElementById("messages").innerHTML += `
        <div class="row p-2 ${position}">
          <div class="col-4">
            <div class="card p-2 ${textPos}" style="max-width:18 rem">
              <p class="p-1">${e.textcontent}</p>
            </div>
          </div>
        </div>
    `
    } else {
      //since theres no text it has to be an image so we can do the image code
      document.getElementById("messages").innerHTML += `
        <div class="row ${position}">
          <div class="col-3">
            <div class="card ${textPos}">
              <img href="${e.imagecontent}">
            </div>
          </div>
        </div>
      `
    }
  })
}

function viewChat(cId) {
  //we also wanna do some sort of like greying out/feedback like with an active property like we do with the navbar
  //ok so we need to get the stuff from one specific chat now
  // so the chat id will be pulled from the request in the function and then we get the users id from inside of the thing itself
  //we also wanna pass the chat id into the localStorage for future use
  localStorage.setItem('openChat', cId)
  document.getElementById('chatwith').innerHTML = `
    <h2 class="text-center">now chatting</h2>`
  fetchMethod(`/api/chats/viewChat/${cId}`, (stat, data) => {
    if (stat == 200) {
      loadChat(data)
    } else if (stat == 401 || stat == 403) {
      window.location.href = ('./login.html')
    }
  }, "GET")
}

//so we need to get the users chats now which is sorta annoying but this is what you signed up for keep it together
function renderChats(results) {
  //this will assemble everything into its bits of info with the functions to call to load their individual chats as well
  //in a perfect world itd be async but time
  results.forEach((e) => {
    console.log(e)
    //so we should have a user name & pfp as well as a chat id for onclick loading
    document.getElementById('chats').innerHTML += `
      <div class="row" id="${e.chat}" onclick="viewChat(${e.chat})">
          <div class="col-10">
              <h4>${e.username}</h4>
          </div>
      </div>
      <hr>
    `
  })
}

document.addEventListener("DOMContentLoaded", () => {
  //so first things first we need to do the most basic of calling the api to get the users chats to load in, first things first\
  //check for a logged in user
  const token = localStorage.getItem('token')
  const uId = localStorage.getItem('loggedInUserId')
  if (!token) {
    wondow.location.href = "./login.html"
    return
  }

  document.getElementById('input-form').addEventListener('submit', () => {
    //ok so we need to figure out how the actual sending a message part goes now which should in theory be easy enough
    sendTxt(document.getElementById('message').value)
    event.preventDefault()
  })

  
  //its by no means my finest work but itll do the trick
  //now we need to make the part where it actually calls the api :pensive:
  fetchMethod("/api/chats", (stat, data) => {
    if (stat == 200) {
      renderChats(data)
    } else if (stat == 401) {
      window.location.href = ('./login.html')
    }
    console.error("problem loading chat list")
  }, "GET", null, token)
  //and now we wanna make the part where it loads a specific chat based on what someone presses

})