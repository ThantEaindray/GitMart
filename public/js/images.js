//this file will handle the bulk of the image handling/support for the chats

const token = localStorage.getItem('token')
const uId = localStorage.getItem('loggedInUserId')
let openChat = localStorage.getItem('openChat')
const webSocket = localStorage.getItem('webSocket');
const toId = localStorage.getItem('toId')
const reader = new FileReader()
document.getElementById("imageuploads").document.addEventListener("submit", (event) => {
  event.preventDefault()
  //so now we wanna do the part where it takes the image and sends it to the temp folder
  //so here there would be the testing and frontend validation and stuff
  
  // just imagine that there is validation
  // check security using virustotal?
  let img=document.getElementById("imageuploads").files[0]
  upImg(img)
  
 
})

function upImg(toUp) {
    //what do we need to do when an image is gonna be uploaded to the server
    // 1. transfer it from the form submission into here
    // 2. copy into local folder (since you have to be in the chat youre sending the images to so having them there helps reduce wait)
    // 3. send to backend
    // 4. backend sends to vps who knows how yet
    //alright step 1, get the files from the form and put it into our code

    //so assuming it works and we do actually get a file passed to us, we then need to send it to the backend
  let cont = {
    type: "message",
    chat: openChat,
    from: uId,
    to: toId,
    cont_type: "img",
    cont:toUp
    }
  //in theory this should allow me to send the image data back to the server, then we figure out how to upload it over scp probably
  fetchMethod("/api/images/send", (stat, data) => {
    //so now what to do on the hypothetical results
    //if it does work it will return a 201 since the WS will handle actually sending out the image
    if (stat == 201) {
      //just return since the ws will actually send host -> client instead of client->host->client
      return (console.log("stat 201 -- image sending"))
    } else {
      return (console.log("UNEXPECTED result", stat, data))
    }
  }, "POST", cont, token)
}