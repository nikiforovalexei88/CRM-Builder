import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  telegram: text("telegram"),
  email: text("email"),
  product: text("product"),
  tariff: text("tariff"),
  price: real("price"),
  netProfit: real("net_profit"),
  source: text("source"),
  externalId: text("external_id"),
  income: text("income"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  managerId: integer("manager_id").notNull(),
  paymentDate: text("payment_date"),
  paymentType: text("payment_type"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date().toISOString()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
