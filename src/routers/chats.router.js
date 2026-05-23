const express = require('express');
const jwt = require ("../middleware/jwtMiddleware.js")
const chatController = require("../controllers/chat.controller.js")
const userController = require ("../controllers/User.controller.js")
const router = express.Router();

router.get("/", jwt.verifyToken, chatController.loadChats, chatController.toLoad ,userController.namesPictures,  chatController.formatList)
router.get("/viewChat", chatController.loadMessages)
router.post("/new", jwt.verifyToken, chatController.newChat)
router.post("/send", chatController.sendText)
//router.post("/sendImg", jwt.verifyToken, chatController.chatExists, chatController.writeImg, chatController.sendMessage)
//router.put("/{id}", jwt.verifyToken, chatController.chatExists, chatController.closeChat)
//for saftey reasons wed want the chats to remain on the servers permanantly (prevent scams & abuse etc.)
//commented out so i can run this for the barebones testing

module.exports=router