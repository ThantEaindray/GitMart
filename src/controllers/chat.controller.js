const model = require("../models/chats.model.js")

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
    
    res.locals.userChats = results.rows
    //we also wanna get a list of just the chat ids to bring back later
    res.locals.chatIds = new Array
    results.rows.forEach((e) => {
      res.locals.chatIds.push(e.id)
    })
    //so that will come back up once we have to format the results 
    next()
  }
  model.loadChats(data,callback)
}

module.exports.toLoad = (req, res, next) => {
  //alright so for this part we want to get the ids of all the users in the chat that isnt our main user
  // we can then push that into the next function that gives us all their names and pfps and stuff
  const data = {
    chats: res.locals.userChats,
    uid: res.locals.userId
  }
  //so we wanna check each chat, find the uid thats different and from there push it to the results array
  let resArr = new Array
  data.chats.forEach((e) => {
    if (e.user_1 == data.uid) {
      resArr.push(e.user_2)
    } else {
      resArr.push(e.user_1)
    }
  }) 
  
  res.locals.toLoad = resArr
  next()
}
  

module.exports.formatList = (req, res, next) => {
  let namesicons = res.locals.namesImgs
  //ok so basically were trying to do an array of objects type deal here
  let chatIds = res.locals.chatIds
  let chatlist = new Array
  //basically we do a for loop so that way we can get a counter for our thing to make it easier to use across multiple arrays
  for (x = 0; x < chatIds.length; x++) { 
    //so we wanna create a new object
    let data = {
      chat: chatIds[x],
      //pfp: namesicons[x][0].icon,
      //uncomment the pfp part when we add support for that (next sprint probably)
      username: namesicons[x][0].username
    }
    chatlist.push(data)
  }
  console.log(chatlist)
  res.status(200).json(chatlist)
}

//commented out since we arent using this one right now
/* 
module.exports.chatExists = (req, res, next) => {
  const data = {
    chat:req.body.data.
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
*/

module.exports.checkAccess = (req, res, next) => {
  const data = {
    chat: res.locals.chatInfo,
    uid: res.locals.userId
  }
  //so we have both the chats 2 ids and the id of the user thats trying to access it. we just compare and see if the chat has the id and if not we 403
  if (data.chat[0].user_1 !== data.uid && data.chat[0].user_2 !== data.uid) {
    return res.status(403).json({message:'you dont have permission to view this chat'})
  }
  //and then we can just next it without doing any sort of db query
  res.locals.openChat = data.chat[0].id
  next()
}

module.exports.loadMessages = (req, res, next) => {
  const data = {
    chatId: req.params.id
  }
  
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem loading messages", err)
      return res.status(500).json(err)
    }
    //so for this we just push out all the results for the chat
    res.status(200).json(results.rows)
  }
  model.loadMessages(data,callback)
}


module.exports.sendText = (req, res, next) => {
  let data =req.body  
  //since cont is already an object why go to all that effort to redeclare everything
  // just renaming it for consistencies sake
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem sending text", err)
      return res.status(500).json(err)      
    }
    //we dont really even need to return anything for this one the ws will do the rest
    res.status(201).json({})
  }
  model.sendText(data,callback)
}

module.exports.hasChat = (req, res, next) => {
  const data = {
    id1: res.locals.userId,
    id2: req.body.id
  }

  //make sure the user isnt trying to make a chat with themself
  if (data.id1 == data.id2) {
    return res.status(409).json({})
  }
  
  const callback = (err, results, fields) => {
    if (err) {
      console.error("problem checking for duplicate chat", err)
      return res.status(500).json(err)
    }
    // if the results length is <0 then we know that the chat exists 
    if (results.length > 0) {
      console.log("chat already exists")
      res.locals.chatid = results.id
      return res.status(409).json({})
    }
    //and finally we can call a next
    next()
  }
  model.hasChat(data,callback)
}

module.exports.newChat = (req,res,next) => {
  const data = {
    initId: res.locals.userId,
    recipId: req.body.id
  }

  const callback = (err, results, fields) => {
    if(err) {
      console.error("problem creating chat", err)
      return res.status(500).json(err)
    }
    res.status(201).json({})
  }
  model.newChat(data,callback)
}