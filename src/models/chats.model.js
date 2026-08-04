const pool = require('./db');

module.exports.loadChats = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM chats
    WHERE user_1 = $1 OR user_2 = $1
  `;
  const VALUES = [data.uid];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.chatExists = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM chats
    WHERE id = $1
  `;
  const VALUES = [data.chat];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.loadMessages = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM chatcontent
    WHERE chat_id = $1
    ORDER BY sentOn ASC
  `;
  const VALUES = [data.chatId];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.uploadCont = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO chatcontent (chat_id, sender_id, cont, cont_type)
    VALUES ($1, $2, $3, $4)
  `;
  const VALUES = [data.chat, data.from, data.cont, data.cont_type];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.hasChat = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM chats
    WHERE (user_1 = $1 AND user_2 = $2)
       OR (user_1 = $2 AND user_2 = $1)
  `;
  const VALUES = [data.id1, data.id2];
  pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.newChat = (data, callback) => {
  const SQLSTATEMENT = `
    INSERT INTO chats (user_1, user_2)
    VALUES ($1, $2)
  `;
  const VALUES = [data.initId, data.recipId];
  pool.query(SQLSTATEMENT, VALUES, callback);
};
