import { client, closeDb } from "@workspace/db";

const statements = [
  "PRAGMA foreign_keys = OFF",
  "DROP TABLE IF EXISTS activities",
  "DROP TABLE IF EXISTS telegram_messages",
  "DROP TABLE IF EXISTS telegram_chats",
  "DROP TABLE IF EXISTS telegram_bot_state",
  "DROP TABLE IF EXISTS invoices",
  "DROP TABLE IF EXISTS payments",
  "DROP TABLE IF EXISTS plans",
  "DROP TABLE IF EXISTS google_sheets_sync_state",
  "DROP TABLE IF EXISTS leads",
  "DROP TABLE IF EXISTS users",
  "PRAGMA foreign_keys = ON",
  `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'manager',
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salary REAL,
      base_bonus REAL,
      multiplier REAL,
      min_plan REAL,
      target_plan REAL,
      max_plan REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      phone TEXT,
      telegram TEXT,
      email TEXT,
      product TEXT,
      tariff TEXT,
      price REAL,
      net_profit REAL,
      source TEXT,
      external_id TEXT,
      income TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT,
      manager_id INTEGER NOT NULL,
      payment_date TEXT,
      payment_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE google_sheets_sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at TEXT,
      last_imported_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER,
      client_name TEXT NOT NULL,
      telegram TEXT,
      tariff TEXT NOT NULL,
      revenue REAL NOT NULL,
      net_profit REAL,
      receivable REAL,
      payment_method TEXT,
      payment_date TEXT NOT NULL,
      manager_id INTEGER NOT NULL,
      payment_schedule TEXT,
      status TEXT DEFAULT 'paid',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      product TEXT,
      min_plan REAL NOT NULL,
      target_plan REAL NOT NULL,
      max_plan REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE telegram_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      manager_id INTEGER,
      telegram_chat_id TEXT UNIQUE,
      telegram_username TEXT,
      client_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_message_text TEXT,
      last_message_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE telegram_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      lead_id INTEGER,
      direction TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id INTEGER,
      telegram_message_id INTEGER,
      text TEXT,
      attachment_name TEXT,
      attachment_type TEXT,
      attachment_path TEXT,
      telegram_file_id TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE telegram_bot_state (
      id INTEGER PRIMARY KEY,
      last_update_id INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  `
    CREATE TABLE invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      chat_id INTEGER,
      manager_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      client_name TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'saved',
      pdf_path TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
  "CREATE INDEX idx_users_role ON users(role)",
  "CREATE INDEX idx_leads_manager_status ON leads(manager_id, status)",
  "CREATE INDEX idx_leads_tariff ON leads(tariff)",
  "CREATE UNIQUE INDEX idx_leads_external_id ON leads(external_id)",
  "CREATE INDEX idx_leads_payment_date ON leads(payment_date)",
  "CREATE INDEX idx_payments_manager_date ON payments(manager_id, payment_date)",
  "CREATE INDEX idx_payments_tariff ON payments(tariff)",
  "CREATE INDEX idx_payments_method ON payments(payment_method)",
  "CREATE INDEX idx_plans_manager_month ON plans(manager_id, month)",
  "CREATE INDEX idx_activities_lead ON activities(lead_id, created_at)",
  "CREATE INDEX idx_telegram_chats_lead ON telegram_chats(lead_id)",
  "CREATE INDEX idx_telegram_chats_manager ON telegram_chats(manager_id)",
  "CREATE INDEX idx_telegram_messages_chat ON telegram_messages(chat_id, created_at)",
  "CREATE INDEX idx_invoices_lead ON invoices(lead_id, created_at)",
  "CREATE INDEX idx_invoices_status ON invoices(status)",
];

async function main() {
  for (const statement of statements) {
    await client.execute(statement);
  }

  console.log("SQLite schema created in data/crm.sqlite");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDb();
  });
