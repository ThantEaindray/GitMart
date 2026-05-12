const pool = require("db.js")
module.exports.allproducts = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM listings
    ORDER BY ? ?`
  const VALUES = [data.order, data.direction]
  pool.query(SQLSTATEMENT,VALUES,callback)
}

module.exports.product = (data, callback) => {
  const SQLSTATEMENT = `
    SELECT * FROM listings WHERE id = ?`
  const VALUES = [data.id]
  pool.query(SQLSTATEMENT,VALUES,callback)
}

module.exports.owner = (data, callback) => {
  const SQLSTATEMENT = `
    select owner_id FROM listings WHERE id = ?`
  const VALUES = [data.id]
  pool.query(SQLSTATEMENT,VALUES,callback)
}

module.exports.updateProduct = (data, callback) => {
  const SQLSTATEMENT = `
    UPDATE listings
    SET title = ?, price = ?, description = ?
    WHERE id = ?`
  const VALUES = [data.newName, data.newPrice, data.newDesc, data.toedit]
  pool.query(SQLSTATEMENT, VALUES, callback)
}
