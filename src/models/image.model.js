const pool = require('./db')

module.exports.writeDB = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO chatcontent (chat_id, sender_id, cont_type, cont)
    VALUES ($1, $2, $3, $4)`
  const VALUES = [data.chat, data.from, data.cont_type, data.cont]
  pool.query(SQLSTATEMENT, VALUES, callback)
}