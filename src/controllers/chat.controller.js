const model = require("../models/chat.model.js")

module.exports.loadChats = (req, res, next) => {
  const data = {
    uid:res.locals.userId
  }
  //so we have the verified user id this is the part where we need to load all the chats
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem loading chats" + err)
      return res.status(500).json(err)
    }

    //we need to check if the user even has any chats to begin with

    if (results.length == 0) {
      console.log("user has no chats to load")
      return res.status(204).json({message:"user has no chats to load"})
    }

    res.locals.userChats = results
    next()
  }
  model.loadChats(data,callback)
}

module.exports.toLoad = (req, res, next) => {
  //alright so for this part we want to get the ids of all the users in the chat that isnt our main user
  // we can then push that into the next function that gives us all their names and pfps and stuff
  const data = {
    chats: res.locals.userChats,
    uid:res.locals.userId
  }
  //so we wanna check each chat, find the uid thats different and from there push it to the results array
  let resArr = new Array
  data.chats.foreach((e) => {
    if (data.chats[e].user_1 == data.uid) {
      resArr.push(data.chats[e].user_2)
    } else {
      resArr.push(data.chats[e].user_1)
    }
  })
  res.locals.toLoad = resArr
  next()
}

module.exports.formatList = (req, res, next) => {
  //so this one is fairly simple we just wanna have it formatted like this
  // [obj] chat[x]={
  // chat-info:[put the actual info about the chat here],
  // hasUnread:[bool]
  // }
  // so this will tell us in the ui to highlight the ones with unread messages

}