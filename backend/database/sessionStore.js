'use strict';

/**
 * MySQL-backed session store for `express-session`.
 *
 * Sessions live in the `sessions` table so that a browser only ever carries an
 * opaque identifier.  The session payload itself (including the authenticated
 * user id and role) stays on the server, which is what makes the server-side
 * authorization checks trustworthy.
 */

const session = require('express-session');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

class MysqlSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;
    // Housekeeping interval: purge expired rows every 15 minutes.
    this.cleanupTimer = setInterval(() => {
      this.purgeExpired().catch((error) => {
        logger.warn('Session cleanup failed', { message: error.message });
      });
    }, 15 * 60 * 1000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  get(sid, callback) {
    pool
      .execute('SELECT data, expires FROM sessions WHERE session_id = ? AND expires > ?', [sid, Date.now()])
      .then(([rows]) => {
        if (!rows.length) return callback(null, null);
        try {
          return callback(null, JSON.parse(rows[0].data));
        } catch (parseError) {
          logger.warn('Discarding unreadable session payload', { sessionId: sid.slice(0, 8) });
          return callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(sid, sessionData, callback = () => {}) {
    const expires = sessionData?.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + this.ttlMs;

    const payload = JSON.stringify(sessionData);

    pool
      .execute(
        `INSERT INTO sessions (session_id, expires, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
        [sid, expires, payload]
      )
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sessionData, callback = () => {}) {
    const expires = sessionData?.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + this.ttlMs;

    pool
      .execute('UPDATE sessions SET expires = ? WHERE session_id = ?', [expires, sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    pool
      .execute('DELETE FROM sessions WHERE session_id = ?', [sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  length(callback) {
    pool
      .execute('SELECT COUNT(*) AS total FROM sessions WHERE expires > ?', [Date.now()])
      .then(([rows]) => callback(null, rows[0].total))
      .catch((error) => callback(error));
  }

  clear(callback = () => {}) {
    pool
      .execute('DELETE FROM sessions')
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  async purgeExpired() {
    await pool.execute('DELETE FROM sessions WHERE expires <= ?', [Date.now()]);
  }

  shutdown() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

module.exports = MysqlSessionStore;
