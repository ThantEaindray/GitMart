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

