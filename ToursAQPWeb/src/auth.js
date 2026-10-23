const crypto = require('crypto');

const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

function generateSalt() {
  return crypto.randomBytes(SALT_BYTES).toString('hex');
}

function hashPassword(password, saltHex) {
  const passwordBuf = Buffer.from(password, 'utf8');
  const saltBuf = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(passwordBuf, saltBuf, ITERATIONS, KEY_LENGTH, 'sha256').toString('hex');
}

function verifyPassword(password, saltHex, expectedHashHex) {
  const computed = Buffer.from(hashPassword(password, saltHex), 'hex');
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

module.exports = { generateSalt, hashPassword, verifyPassword };
