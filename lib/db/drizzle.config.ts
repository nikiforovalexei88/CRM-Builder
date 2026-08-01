import path from "node:path";
import { defineConfig } from "drizzle-kit";

const sqliteFile = process.env.SQLITE_FILE ?? path.resolve(import.meta.dirname, "..", "..", "data", "crm.sqlite");

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteFile,
  },
});
