import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderNumber: integer("order_number"),
  clientName: text("client_name").notNull(),
  telegram: text("telegram"),
  tariff: text("tariff").notNull(),
  revenue: real("revenue").notNull(),
  netProfit: real("net_profit"),
  receivable: real("receivable"),
  paymentMethod: text("payment_method"),
  paymentDate: text("payment_date").notNull(),
  managerId: integer("manager_id").notNull(),
  paymentSchedule: text("payment_schedule"),
  status: text("status").default("paid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
