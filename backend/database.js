const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const usePostgres = Boolean(process.env.DATABASE_URL);
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'ricehub.sqlite');

let sqliteDb;
let pgPool;
let sqlite3;

if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });
} else {
  sqlite3 = require('sqlite3').verbose();
  fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new sqlite3.Database(dbPath);
}

function normalizeSql(sql) {
  if (!usePostgres) return sql;
  let index = 0;
  const normalized = sql
    .replace(/CURRENT_TIMESTAMP/g, 'NOW()')
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
    .replace(/\?/g, () => `$${++index}`);
  if (/^\s*INSERT\s+/i.test(normalized) && !/\sRETURNING\s+/i.test(normalized)) {
    return `${normalized} RETURNING id`;
  }
  return normalized;
}

function run(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(normalizeSql(sql), params).then((result) => ({
      id: result.rows?.[0]?.id,
      changes: result.rowCount,
    }));
  }

  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function handleRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(normalizeSql(sql), params).then((result) => result.rows[0]);
  }

  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  if (usePostgres) {
    return pgPool.query(normalizeSql(sql), params).then((result) => result.rows);
  }

  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function initDatabase() {
  if (!usePostgres) {
    await run('PRAGMA foreign_keys = ON');
  }

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT '',
      origin TEXT NOT NULL DEFAULT '',
      unit TEXT NOT NULL DEFAULT 'kg',
      price INTEGER NOT NULL DEFAULT 0,
      cost INTEGER NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      customer_group TEXT NOT NULL DEFAULT 'Khách lẻ',
      debt INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      unit_price INTEGER NOT NULL,
      total INTEGER NOT NULL,
      paid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Đang giao',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS debt_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'Gọi điện',
      content TEXT NOT NULL DEFAULT '',
      promised_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Đã liên hệ',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);
}

async function transaction(callback) {
  await run('BEGIN');
  try {
    const result = await callback();
    await run('COMMIT');
    return result;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

async function close() {
  if (usePostgres) {
    await pgPool.end();
  } else {
    sqliteDb.close();
  }
}

module.exports = {
  dbPath,
  dbType: usePostgres ? 'postgres' : 'sqlite',
  initDatabase,
  run,
  get,
  all,
  transaction,
  close,
};
