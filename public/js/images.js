//this file will handle the bulk of the image handling/support for the chats

const token = localStorage.getItem('token')
const uId = localStorage.getItem('loggedInUserId')
let openChat = localStorage.getItem('openChat')
const webSocket = localStorage.getItem('webSocket');
const reader = new FileReader()
document.getElementById("imageuploads").document.addEventListener("submit", (event) => {
  event.preventDefault()
  //so now we wanna do the part where it takes the image and sends it to the temp folder
  //so here there would be the testing and frontend validation and stuff
  
  // just imagine that there is validation
  // check security using virustotal?
  let img=document.getElementById("imageuploads").files[0]
  upImg()
  
 
})

function upImg(toUp) {
    //what do we need to do when an image is gonna be uploaded to the server
    // 1. transfer it from the form submission into here
    // 2. copy into local folder (since you have to be in the chat youre sending the images to so having them there helps reduce wait)
    // 3. send to backend
    // 4. backend sends to vps who knows how yet
    //alright step 1, get the files from the form and put it into our code
    let 
  
}

function loadImg(toLoad) {
  //so what do we need to do when we want to load an image
  // 1. call the backend (give filename stored in the query)
  // 2. backend will call ftp
  // 3. load image into temp folder
  // 4. display image from temp folder
  // 5. clear when user leaves the chat
  fetchMethod("/api/images/download", (stat, data) => {
    
  })
}