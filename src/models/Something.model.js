const pool = require('./db');

module.exports.selectAll = (callback) => {
    const SQLSTATEMENT = `SELECT * FROM "Something"`;
    const VALUES = [];
    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.selectById = (data, callback) => {
    const SQLSTATEMENT = `SELECT * FROM "Something" WHERE "id" = $1`;
    const VALUES = [data.id];
    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.insertSingle = (data, callback) => {
    const SQLSTATEMENT = `INSERT INTO "Something" ("name") VALUES ($1) RETURNING *`;
    const VALUES = [data.name];
    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.updateById = (data, callback) => {
    const SQLSTATEMENT = `UPDATE "Something" SET "name" = $1 WHERE "id" = $2 RETURNING *`;
    const VALUES = [data.name, data.id];
    pool.query(SQLSTATEMENT, VALUES, callback);
};

module.exports.deleteById = (data, callback) => {
    const SQLSTATEMENT = `DELETE FROM "Something" WHERE "id" = $1 RETURNING *`;
    const VALUES = [data.id];
    pool.query(SQLSTATEMENT, VALUES, callback);
};
