const crypto = require('crypto');

console.log(
  'Store this key in the CHS_HANDSHAKE_KEY environment variable on both client and server machines.'
);
console.log('Handshake Key:', crypto.randomBytes(32).toString('hex'));
