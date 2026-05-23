const pool = require("./db")

module.exports.loadChats = (data, callback) => {
  const SQLSATEMENT = `
    SELECT * FROM chats WHERE user_1 = $1 OR user_2 = $1`
  const VALUES = [data.uid]
  pool.query(SQLSATEMENT,VALUES,callback)
}

module.exports.chatExists = (data, callback) => {
  const SQLSATEMENT = ` 
    SELECT * FROM chats WHERE id = $1`
  const VALUES = [data.chat]
  pool.query(SQLSATEMENT, VALUES, callback)
}

module.exports.loadMessages = (data, callback) => {
  const SQLSATEMENT = `
    SELECT * FROM chatcontent WHERE chat_id = $1
    ORDER BY sentOn DESC`
  const VALUES = [data.chatId]
  pool.query(SQLSATEMENT,VALUES,callback)
}

module.exports.sendText = (data, callback) => {
  const SQLSATEMENT = `
    INSERT INTO chatcontent (chat_id, sender_id, textcontent)
    VALUES ($1, $2, $3)`
  const VALUES = [data.chat, data.user, data.textcontent]
  pool.query(SQLSATEMENT, VALUES, callback)
}

module.exports.hasChat = (data, callback) => {
  const SQLSATEMENT = `
    SELECT * FROM chats WHERE (user_1 = $1 AND user_2= $2) OR (user_1 = $2 AND user_2=$1)`
  const VALUES = [data.id1, data.id2]
  pool.query(SQLSATEMENT,VALUES,callback)
}

module.exports.newChat = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO chats (user_1, user_2)
    VALUES ($1, $2)`
  const VALUES = [data.initId, data.recipId]
  pool.query(SQLSTATEMENT, VALUES,callback)
}