/**
 * Escapes special regex metacharacters in a user-supplied string.
 * Prevents ReDoS (Regular Expression Denial of Service) attacks.
 * @param {string} str - Raw user input
 * @returns {string} - Safe string for use in new RegExp()
 */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
