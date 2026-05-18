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
  // uname: [name of other user]
  // uicon: [pfp of other user]
  // }
  
}
//idk this ones kinda a lot of work lets circle back to it later

module.exports.chatExists = (req, res, next) => {
  const data = {
    chat:req.body.id
  }

  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem checking if chat exists", err)
      return res.status(500).json(err)
    }

    //404 if the results from the query return no results
    if (results.length == 0) {
      console.error("no chat with that id found")
      return res.status(404).json({message:"chat not found"})
    }

    //and then once we know it exists we put the chat info into the .locals for our convenience with the rest of the stuff that we need
    res.locals.chatInfo = results
    next()
  }
  model.checkExists(data,callback)
}

module.exports.checkAccess = (req, res, next) => {
  const data = {
    chat: res.locals.chatInfo,
    uid: res.locals.userId
  }
  //so we have both the chats 2 ids and the id of the user thats trying to access it. we just compare and see if the chat has the id and if not we 403
  if (data.chat[0].user_1 !== data.uid && data.chat[0].user_2 !== data.uid) {
    return res.status(403).json({message:'you dont have permission to view this chat'})
  }
  //and then we can just next it without doing any sort of db query yippee 
  res.locals.openChat = data.chat[0].id
  next()
}

module.exports.loadMessages = (req, res, next) => {
  const data = {
    chatId: res.locals.openChat,
  }
  
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem loading messages", err)
      return res.status(500).json(err)
    }
    //so for this we just push out all the results for the chat 
    res.status(200).json(results)
  }
  model.loadMessages(data,callback)
}

//now comes the next big chunk of endpoints yippee yahooo
//so for now it will just send the image file to a folder in the local area but on actual deployment youd want a cdn bear this in mind when going forward
module.exports.sendMessage = (req, res, next) => {
  //so we need to take all the inputs from the thing and then send them through to the model for uploading
  const data = {
    chatId: res.locals.openChat,
    uid: res.locals.userId,
    content: req.body.text,
    image: req.body.image
  }
  //so we need to set up a thing to write the image into the cdn (local folder currently) storage and then have the link be referenced inside of the db just as a string alright thats way easier than doing all this binaryslop
  //so we need to push it back through to the backend and from there we need to figure out how to write it to the thing but like fuck thats a lot of effort
  //ouh this one is a lot of work i really dont feel like doing this 
  // we still need to make the handling for if the user is still in the thing in the chat
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem sending message", err)
      return res.status(500).json(err)
    }
    //well the next thing that would need to happen is it will trigger some sort of listener that queries globally if the message is for the open chat and will refresh it/add the message somehow
    res.status()
  }
}