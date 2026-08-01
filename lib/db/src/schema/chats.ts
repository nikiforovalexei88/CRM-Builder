import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramChatsTable = sqliteTable("telegram_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id"),
  managerId: integer("manager_id"),
  telegramChatId: text("telegram_chat_id").unique(),
  telegramUsername: text("telegram_username"),
  clientName: text("client_name").notNull(),
  status: text("status").notNull().default("pending"),
  lastMessageText: text("last_message_text"),
  lastMessageAt: text("last_message_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const telegramMessagesTable = sqliteTable("telegram_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: integer("chat_id").notNull(),
  leadId: integer("lead_id"),
  direction: text("direction").notNull(),
  senderType: text("sender_type").notNull(),
  senderId: integer("sender_id"),
  telegramMessageId: integer("telegram_message_id"),
  text: text("text"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  attachmentPath: text("attachment_path"),
  telegramFileId: text("telegram_file_id"),
  status: text("status").notNull().default("sent"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const telegramBotStateTable = sqliteTable("telegram_bot_state", {
  id: integer("id").primaryKey(),
  lastUpdateId: integer("last_update_id").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertTelegramChatSchema = createInsertSchema(telegramChatsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTelegramMessageSchema = createInsertSchema(telegramMessagesTable).omit({ id: true, createdAt: true });

export type InsertTelegramChat = z.infer<typeof insertTelegramChatSchema>;
export type InsertTelegramMessage = z.infer<typeof insertTelegramMessageSchema>;
export type TelegramChat = typeof telegramChatsTable.$inferSelect;
export type TelegramMessage = typeof telegramMessagesTable.$inferSelect;
