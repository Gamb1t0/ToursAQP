const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.TOURS_DB_PATH || path.join(__dirname, '..', 'data', 'Tours.s3db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

module.exports = db;
