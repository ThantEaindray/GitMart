const express = require("express");
const router = express.Router();

//require router files
const chatroutes = require("./chats.router.js")
const jwtMiddleware = require("../middlewares/jwtMiddleware");
const bcryptMiddleware = require('../middlewares/bcryptMiddleware');

//set the routes 
router.use("/chat",chatroutes)

module.exports.router