//this file will handle the bulk of the image handling/support for the chats

const token = localStorage.getItem('token')
const uId = localStorage.getItem('loggedInUserId')
let openChat = localStorage.getItem('openChat')
const webSocket = localStorage.getItem('webSocket');
let toId = localStorage.getItem('toId')
document.getElementById("imageuploads").document.addEventListener("submit", (event) => {
  event.preventDefault()
    //so now we wanna do the part where it takes the image and sends it to the temp folder
    //so here there would be the testing and frontend validation and stuff
  let fromForm = document.getElementById('fileinput')
    // just imagine that there is validation
    // check security using virustotal?
    //lets just construct the form data here i suppose
  let form = new FormData()
  form.append("type", "message")
  form.append("chat", openChat)
  form.append("from", uId)
  form.append("to", toId)
  form.append("cont_type", "img")
  form.append("cont", fromForm.files[0])
  //so now that we have the data all nice and pretty we should be able to send it to the backend
  upImg(form)
})

function upImg(toUp) {
  //what do we need to do when an image is gonna be uploaded to the server
  // 1. transfer it from the form submission into here
  // 2. copy into local folder (since you have to be in the chat youre sending the images to so having them there helps reduce wait)
  // 3. send to backend
  // 4. backend sends to vps who knows how yet
  //alright step 1, get the files from the form and put it into our code

  //so assuming it works and we do actually get a file passed to us, we then need to send it to the backend
  //ok no so we need to make our own fetch to let it handle multipart data since from what i understand the bed one cant

  //ok so firstly we need to set the token in the headers and for that we need to do 2 things
  // 1 declare an empty object as the headers
  let headers = {}
  //2 add the token to the headers which this nifty little code should do
  if (token) {
    headers["Authorization"] = "Bearer " + token;
  }

  fetch("/api/images/upload", {
    method: 'POST',
    headers: headers,
    body: toUp
  })
}