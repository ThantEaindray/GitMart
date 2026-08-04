const express = require('express');
const jwt = require ("../middleware/jwtMiddleware.js")
const chatController = require("../controllers/chat.controller.js")
const imgController = require('../controllers/image.controller.js')
const path=require('node:path')
const multer = require ("multer")
const router = express.Router();

//----MULTER CONFIG MUST BE HERE OR THE WHOLE THING BREAKS ABSOLUTELY DO NOT MOVE!!!!!!!!----
const storage = multer.diskStorage({
  destination: './src/tmp',
  filename: function(req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
})
const upload = multer({storage:storage})
//generate a unique name for each image and also get multer ready to do its thing

router.post('/send', jwt.verifyToken,upload.single("cont"), imgController.uploadImg, imgController.writeDB, imgController.sendWS, imgController.cleanup)
module.exports=router