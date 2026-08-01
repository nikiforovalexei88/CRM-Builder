import { db, leadsTable, usersTable, client } from "@workspace/db";
import { eq } from "@workspace/db";
import { logger } from "../lib/logger";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtMpUuOPhKwODFRWZpclCpeaJv3uVOHia_MJg8IuPYrdRYmN45-OyfyFxGe6h50d9jfBsGYSS6waEd/pub?gid=1863668531&single=true&output=csv";

const SYNC_INTERVAL_MS = 60_000;

const TARIFFS: Record<string, { tariff: string; price: number }> = {
  "Самостоятельное обучение": { tariff: "сам", price: 34_990 },
  "Обучение с куратором": { tariff: "куратор", price: 54_990 },
  "Обучение с VIP сопровождением от автора курса": { tariff: "вип", price: 79_990 },
  "Часовая консультация": { tariff: "1 конс", price: 5_000 },
};

let isSyncing = false;
let autoSyncStarted = false;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalize(value?: string) {
  return (value ?? "").trim();
}

function parseTimestamp(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  if (!match) return new Date().toISOString();
  const [, day, month, year, time] = match;
  return `${year}-${month}-${day} ${time}`;
}

function makeExternalId(row: Record<string, string>) {
  return [
    "google_sheets",
    normalize(row["Отметка времени"]),
    normalize(row["Выберите продукт"]),
    normalize(row["Как к вам обращаться"]),
    normalize(row["Ваш номер телефона для связи"]),
    normalize(row["Ваш никнейм в Telegram"]),
  ].join(":").toLowerCase();
}

async function notifyTelegramLead(row: Record<string, string>, tariff: { tariff: string; price: number }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const message = [
    "Новая заявка из Google Sheets",
    "",
    `Клиент: ${row["Как к вам обращаться"] || "-"}`,
    `Телефон: ${row["Ваш номер телефона для связи"] || "-"}`,
    `Telegram: ${row["Ваш никнейм в Telegram"] || "-"}`,
    `Продукт: ${row["Выберите продукт"] || "-"}`,
    `Тариф CRM: ${tariff.tariff}`,
    `Запрос: ${row["Запрос"] || "-"}`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Telegram returned ${response.status}: ${details}`);
  }
}

async function ensureGoogleSheetsSchema() {
  const columns = await client.execute("PRAGMA table_info(leads)");
  const hasExternalId = columns.rows.some((row) => row.name === "external_id");
  if (!hasExternalId) {
    await client.execute("ALTER TABLE leads ADD COLUMN external_id TEXT");
    await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_external_id ON leads(external_id)");
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS google_sheets_sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_sync_at TEXT,
      last_imported_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getDefaultManagerId() {
  const [vasya] = await db.select().from(usersTable).where(eq(usersTable.username, "vasya"));
  if (vasya) return vasya.id;
  const [firstUser] = await db.select().from(usersTable);
  if (!firstUser) throw new Error("No users found for Google Sheets import");
  return firstUser.id;
}

export async function syncGoogleSheetsLeads() {
  if (isSyncing) return { imported: 0, skipped: 0, total: 0, locked: true };
  isSyncing = true;

  try {
    await ensureGoogleSheetsSchema();

    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Google Sheets CSV returned ${response.status}`);

    const rows = parseCsv(await response.text());
    const headers = rows[0]?.map(normalize) ?? [];
    const dataRows = rows.slice(1);
    const managerId = await getDefaultManagerId();
    let imported = 0;
    let skipped = 0;

    for (const values of dataRows) {
      const row = Object.fromEntries(headers.map((header, index) => [header, normalize(values[index])]));
      const clientName = row["Как к вам обращаться"];
      if (!clientName) {
        skipped += 1;
        continue;
      }

      const product = row["Выберите продукт"];
      const tariff = TARIFFS[product] ?? { tariff: product || "сам", price: 0 };
      const externalId = makeExternalId(row);
      const existing = await db.select({ id: leadsTable.id }).from(leadsTable).where(eq(leadsTable.externalId, externalId));

      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      await db.insert(leadsTable).values({
        clientName,
        phone: row["Ваш номер телефона для связи"] || null,
        telegram: row["Ваш никнейм в Telegram"] || null,
        product,
        tariff: tariff.tariff,
        price: tariff.price,
        source: "Google Sheets",
        externalId,
        notes: row["Запрос"] || null,
        status: "new",
        managerId,
        createdAt: parseTimestamp(row["Отметка времени"]),
      });
      await notifyTelegramLead(row, tariff).catch((error) => logger.warn({ err: error }, "Telegram lead notification failed"));
      imported += 1;
    }

    await client.execute({
      sql: `
        INSERT INTO google_sheets_sync_state (id, last_sync_at, last_imported_count, updated_at)
        VALUES (1, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          last_sync_at = CURRENT_TIMESTAMP,
          last_imported_count = excluded.last_imported_count,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [imported],
    });

    return { imported, skipped, total: dataRows.length, locked: false };
  } finally {
    isSyncing = false;
  }
}

export function startGoogleSheetsAutoSync() {
  if (autoSyncStarted) return;
  autoSyncStarted = true;

  setTimeout(() => {
    void syncGoogleSheetsLeads().catch((error) => logger.warn({ err: error }, "Google Sheets sync failed"));
  }, 5_000);

  setInterval(() => {
    void syncGoogleSheetsLeads().catch((error) => logger.warn({ err: error }, "Google Sheets sync failed"));
  }, SYNC_INTERVAL_MS);
}
