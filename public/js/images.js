//this file will handle the bulk of the image handling/support for the chats
document.getElementById("imageuploads").document.addEventListener("submit", (event) => {
  event.preventDefault()
  //so now we wanna do the part where it takes the image and sends it to the temp folder
  //so here there would be the testing and frontend validation and stuff


  fetchMethod("/api/images/upload", (stat, data) => {
    
  })
})