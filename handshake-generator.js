/**
 * Utility script to generate a secure handshake key for authentication between client and server
 * @module handshake-generator
 */
import crypto from 'crypto';

/**
 * Generates a random string of specified length with some letters capitalized
 * @param {number} length - The desired length of the output string
 * @returns {string} A random string with some letters capitalized
 */
const randomWithCapitals = (length) => {
  return crypto
    .randomBytes(length / 2)
    .toString('hex')
    .replace(/[a-f]/g, (c) => (Math.random() > 0.33 ? c.toUpperCase() : c));
};

console.log(
  'Store this key in the CHS_HANDSHAKE_KEY environment variable on both client and server machines.'
);
console.log(
  'Handshake Key:',
  `chs_${randomWithCapitals(16)}_${randomWithCapitals(48)}`
);
