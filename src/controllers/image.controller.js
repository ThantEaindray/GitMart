const model = require("../models/image.model.js")
const dotenv = require("dotenv")
const { client } = require('node-scp')
const multer=require('multer')
const fs = require('fs')
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.dev';

module.exports.saveTmp = (req, res, next) => {
  try {
              let storage = multer.diskStorage({
                  destination: function (req, file, cb) {
                      let id = req.headers.room_id;
                      let path = `tmp/daily_gasoline_report/${id}`;
                      fsextra.mkdirsSync(path);
                      cb(null, path);
                  },
                  filename: function (req, file, cb) {
                    let uniquename = file.fieldname + '-' + Date.now() + "." + 
                    res.locals.uniquename = uniquename
                      cb(null, uniquename);
                  }
              })
              var upload = multer({ storage: storage }).array('images', 100);
              upload(req, res, function (err) {
                  if (err) {
                      console.log(err);
                      return res.end("Error uploading file.");
                  } else {
                      res.end("File has been uploaded");
                  }
              });
              let result = error.OK
              logger.info(result);
              return res.status(200).send(result)
  
          } catch (err) {
              logger.warn(err);
              console.log(err);
              return res.status(500).send(error.SERVER_ERROR)
          }
      }
}













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
      req.body.cont,
      `${process.env.SCP_DIR}${}`
    )
      .then(response => {
        client.close()
      })
      .catch(error => { })
  }).catch(e => console.log(e))
}
