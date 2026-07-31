const model = require("../models/image.model.js")
const dotenv = require("dotenv")
const {client} = require('node-scp')
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env.dev';

dotenv.config({
  path: path.join(__dirname, '../..', envFile),
});
//set up options for the scp process
var options = {
  username: process.env.SCP_USR,
  password: process.env.SCP_PWD,
  host: process.env.SCP_IP,
  port: process.env.SCP_PORT
}
//so firstly we wanna download the image to the local temp file first i think
// and then pass it on to the thing

module.exports.uploadImg = (req, res, next) => {
  client(options).then(client => {
    client.uploadFile(
      //so we need to get the file which we want to upload over here and then we send that onwards to the server oooooo the magic of the cloud
      req.body.cont,
      `${process.env.SCP_DIR}${x}`
    )
      .then(response => {
        client.close()
      })
      .catch(error => { })
  }).catch(e => console.log(e))
}
