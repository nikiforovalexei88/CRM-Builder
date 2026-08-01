import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.resolve(__dirname, "..", "..", "..", "data", "crm.sqlite");
const sqliteFile = process.env.SQLITE_FILE ?? defaultDbPath;
const sqliteUrl = process.env.SQLITE_URL ?? `file:${sqliteFile}`;

if (!process.env.SQLITE_URL) {
  fs.mkdirSync(path.dirname(sqliteFile), { recursive: true });
}

export const client = createClient({ url: sqliteUrl });
export const db = drizzle(client, { schema });

export async function closeDb() {
  client.close();
}

export { and, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
export * from "./schema";
