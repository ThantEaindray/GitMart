const { loadChats } = require("../../src/controllers/chat.controller")
document.addEventListener("DOMContentLoaded", ()=> {
  //so first things first we need to do the most basic of calling the api to get the users chats to load in, first things first\
  //check for a logged in user
  const token = localStorage.getItem(token)
  const uId = localStorage.getItem(loggedInUserId)
  if (!token) {
    wondow.location.href = "./login.html"
    return
  }
  //so we need to get the users chats now which is sorta annoying but this is what you signed up for keep it together
  function renderChats(results) {
  //this will assemble everything into its bits of info with the functions to call to load their individual chats as well
  //in a perfect world itd be async but time
    results.forEach((e) => {
    //so we should have a user name & pfp as well as a chat id for onclick loading
      document.getElementById('chats').innerHTML += `
        <div class="row" id="${e.chat}" onclick="viewChat(${e.chat})">
            <div class="col-2">
                <img src="${e.pfp}">
            </div>
            <div class="col-10">
                <h4>${e.username}</h4>
            </div>
        </div>
        <hr>
      `
    })
  }
  //its by no means my finest work but itll do the trick
  //now we need to make the part where it actually calls the api :pensive:
  fetchmethod("/api/chats", (stat, data) => {
    if (stat == 200) {
      renderChats(data)
    } else if (stat == 401) {
      window.location.href =('./login.html')
    }
      console.error("problem loading chat list")
  }, "GET", null, token)
  //and now we wanna make the part where it loads a specific chat based on what someone presses
  function viewChat(cId) {
  //we also wanna do some sort of like greying out/feedback like with an active property like we do with the navbar
  //ok so we need to get the stuff from one specific chat now 
  // so the chat id will be pulled from the request in the function and then we get the users id from inside of the thing itself
    
    
   loadChat()
  
    fetchmethod("/api/chats/viewChat", (stat, data) => {
      if (stat == 200) {
        loadChat(data)
        startWS()
      } else if (stat == 401 || stat == 403) {
        window.location.href=('./login.html')
      }
    }, "GET", cId, token)

    
  })
