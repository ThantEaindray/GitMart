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

module.exports.checkUnread = (req, res, next) => {
  //firstly we need to get a list of every chat by id only
  // after that we check to see if theres any unread messages
  // then we check & exclude any where the user is the sender

  //making the list of chat ids
  let longChats = res.locals.userChats
  let cIdArr = new array 
  longChats.forEach((e) => {
    cIdArr.push(longChats[e].id)
  })
  //so now that we (in theory) have an array of all the users chats

  const data = {
    uId: res.locals.userId,
    cId: cIdArr
  }

  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem checking for unread messages" + err)
      return res.status(500).json(err)
    }
    //so now we (hopefully) have a list of chat ids with unread messages for the user
    //what we want now is just to send it to the next fn to be formatted nicely for the user since this ones already long enough
    res.locals.unread = results
    next()
  }
  model.checkUnread(data,callback)
}

module.exports.formatList = (req, res, next) => {
  //so this one is fairly simple we just wanna have it formatted like this
  // [obj] chat[x]={
  // chat-info:[put the actual info about the chat here],
  // hasUnread:[bool]
  // }
  // so this will tell us in the ui to highlight the ones with unread messages

}