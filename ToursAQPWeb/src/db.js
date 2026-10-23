const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, '..', 'data', 'Tours.s3db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');

module.exports = db;
