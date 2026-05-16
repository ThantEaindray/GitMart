const express = require('express');
const jwt = require ("../middleware/jwtMiddleware.js")
const chatController = require("../controllers/chat.controller.js")
const userController = require ("../controllers/User.controller.js")
const router = express.Router();

router.get("/", jwt.verifyToken, chatController.loadChats, chatController.toLoad ,userController.namesPictures,  chatController.formatList)
router.get("/{id}", jwt.verifyToken, chatController.hasAccess, chatController.loadMessages, chatController.markRead)
router.post("/new", jwt.verifyToken, chatController.chatExists , chatController.newChat)
router.post("/send", jwt.verifyToken, chatController.chatExists, chatController.sendMessage)
router.put("/{id}", jwt.verifyToken, chatController.chatExists, chatController.closeChat)
//for saftey reasons wed want the chats to remain on the servers permanantly (prevent scams & abuse etc.)

module.exports=router