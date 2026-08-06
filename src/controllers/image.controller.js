const model = require('../models/image.model.js');
const { Client } = require('node-scp');
const fs = require('fs');
// Required lazily inside sendWS below, not here at module load time — see
// the matching note in chat.controller.js for why requiring it up front
// crashes anything that loads app.js before server.js has run.
//set up options for the scp process
//so firstly we wanna download the image to the local temp file first i think
// and then pass it on to the thing

//now we have the path preset for where we put all our temp files.
module.exports.uploadImg = (req, res, next) => {
  console.log('uploading');
  //so what do we need to do first to  get an image uploaded we need to save it over to the temp folder and from there we can reference it
  Client({
    username: process.env.SCP_USR,
    password: process.env.SCP_PWD,
    host: process.env.SCP_IP,
    port: process.env.SCP_PORT,
  }).then((client) => {
    client
      .uploadFile(
        //so we need to get the file which we want to upload over here and then we send that onwards to the server oooooo the magic of the cloud
        `./src/tmp/${req.file.filename}`,
        `${process.env.SCP_DIR}/${req.file.filename}`,
      )
      .then((_response) => {
        client.close();
        next();
      })
      .catch((error) => {
        return res.status(500).json(error);
      });
  });
};

//ok so theoretically we do have the thing working now so what needs to be done is just the rest of the flow which is at least easier to do

module.exports.writeDB = (req, res, next) => {
  //nice and easy this time we just have to get the info we need about the message and write it into the db

  let path = `http://${process.env.SCP_IP}/${req.file.filename}`;
  res.locals.path = path;
  const data = {
    chat: req.body.chat,
    from: res.locals.userId,
    cont_type: req.body.cont_type,
    cont: path,
  };

  const callback = (err, _results, _fields) => {
    if (err) {
      console.log(err);
      return res.status(500).json(err);
    } else {
      next();
    }
  };
  model.writeDB(data, callback);
};

//this is the hard part how do we get all the way to the ws when were so deep in here right
// ig we call some sort of a function on the app.js and then we next when its done
module.exports.sendWS = (req, res, next) => {
  console.log('sendws');
  //all we need to do in this fn is we format the data nicely and send it over to app.js to handle the ws parts
  const data = {
    type: 'message',
    from: res.locals.userId,
    to: req.body.to,
    chat: req.body.chat,
    cont_type: 'img',
    cont: res.locals.path,
  };

  require('../server.js').send(data);
  next();
};

module.exports.cleanup = (req, res, _next) => {
  let file = `./src/tmp/${req.file.filename}`;
  fs.unlink(file, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    } else {
      return res.status(201).json();
    }
  });
};
