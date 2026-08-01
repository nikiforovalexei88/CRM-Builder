import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerId: integer("manager_id").notNull(),
  month: text("month").notNull(), // YYYY-MM
  product: text("product"),
  minPlan: real("min_plan").notNull(),
  targetPlan: real("target_plan").notNull(),
  maxPlan: real("max_plan").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date().toISOString()),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
