const model = require("../models/image.model.js")
const dotenv = require("dotenv")
const { client } = require('node-scp')
const fs = require('fs')
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.dev';
const svr = require ("../server.js")
//set up options for the scp process
var options = {
  username: process.env.SCP_USR,
  password: process.env.SCP_PWD,
  host: process.env.SCP_IP,
  port: process.env.SCP_PORT
}
//so firstly we wanna download the image to the local temp file first i think
// and then pass it on to the thing

//now we have the path preset for where we put all our temp files.
module.exports.uploadImg = (req, res, next) => {
//so what do we need to do first to  get an image uploaded we need to save it over to the temp folder and from there we can reference it

  
  client(options).then(client => {
    client.uploadFile(
      //so we need to get the file which we want to upload over here and then we send that onwards to the server oooooo the magic of the cloud
      `../tmp/${req.file}`,
      `${process.env.SCP_DIR}/${req.file}`
    )
      .then(response => {
        client.close()
        next()
      })
      .catch(error => {
        return res.status(500).json(error)
      })
  })
}


//ok so theoretically we do have the thing working now so what needs to be done is just the rest of the flow which is at least easier to do

module.exports.writeDB = (req, res, next) => {
  //nice and easy this time we just have to get the info we need about the message and write it into the db

  let path = `http://${process.env.SCP_IP}/${req.file}`
  res.locals.path = path
  const data = {
    chat_id: req.body.chat,
    sender_id: req.body.from,
    cont_type: req.body.cont_type,
    cont: path
  }

  const callback = (err, results, fields) => {
    if (err) {
      console.log(err)
      return res.status(500).json(err)
    } else {
      next()
    }
  }
  model.writeDB(data,callback)
}


module.exports.cleanup = (req, res, next) => {
  //this really the only thing it does is delete the file from the tmp folder
  //i mean also it should return a lovely 201
  try {
    fs.unlink(`../tmp/${req.file}`)
  } catch (err) {
    return res.status(500).json(err)
  } 
  res.status(201).json({})
    
}

//this is the hard part how do we get all the way to the ws when were so deep in here right
// ig we call some sort of a function on the app.js and then we next when its done
module.exports.sendWS = (req, res, next) => {
  //all we need to do in this fn is we format the data nicely and send it over to app.js to handle the ws parts
  const data = {
    type: "message",
    from: req.body.from,
    to: req.body.to,
    chat: req.body.chat,
    cont_type: "img",
    cont:res.locals.path
  }
  
  svr.sendImg(data)
  next()
}
//lowk we can do this one later (tmr) im too tired now 