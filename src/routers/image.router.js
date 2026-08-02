const express = require('express');
const jwt = require ("../middleware/jwtMiddleware.js")
const chatController = require("../controllers/chat.controller.js")
const imgController = require('../controllers/image.controller.js')
const router = express.Router();

const upload = multer({ storage: storage })
//multer can only be called here and from here we need to grab the thing so 

// ok so for sending the message theres a few things we need to do
// firstly we need to make sure the user is logged in easy sneesy
router.post('/images/send', jwt.verifyToken, imgController.saveTmp ,imgController.uploadImg, imgController.writeDB, imgController.sendWS)