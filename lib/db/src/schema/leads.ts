import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  telegram: text("telegram"),
  email: text("email"),
  product: text("product"),
  tariff: text("tariff"),
  price: real("price"),
  netProfit: real("net_profit"),
  source: text("source"),
  income: text("income"),
  status: text("status").notNull().default("new"),
  notes: text("notes"),
  managerId: integer("manager_id").notNull(),
  paymentDate: text("payment_date"),
  paymentType: text("payment_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
