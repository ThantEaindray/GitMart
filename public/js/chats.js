document.addEventListener("DOMContentLoaded", ()=> {
  //so first things first we need to do the most basic of calling the api to get the users chats to load in, first things first\
  //check for a logged in user
  const token = localStorage.getItem(token)
  if (!token) {
    wondow.location.href = "/html/login.html"
    return
  }
  //so we need to get the users chats now which is sorta annoying but this is what you signed up for keep it together
  function renderChats(results) {
  //this will assemble everything into its bits of info with the functions to call to load their individual chats as well
  //in a perfect world itd be async but time
    results.forEach((e) => {
    //so we should have a user name & pfp as well as a chat id for onclick loading
      document.getElementById('chats').innerHTML += `
        <div class="row" onclick="viewChat(${e.chat})">
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
    if (stat = 200) {
      renderChats(data)
    } else console.error("problem loading chat list")
  }, "GET")
  //and now we wanna make the part where it loads a specific chat based on what someone presses
  function viewChat(id, uid) {
    
  }
})