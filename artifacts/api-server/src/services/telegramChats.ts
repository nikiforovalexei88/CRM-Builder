import fs from "node:fs";
import path from "node:path";
import { client, db, eq, leadsTable, telegramBotStateTable, telegramChatsTable, telegramMessagesTable, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

const POLL_INTERVAL_MS = 4_000;
let pollingStarted = false;
let botUsername: string | null = null;

type ChatRow = typeof telegramChatsTable.$inferSelect;

function token() {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function apiUrl(method: string) {
  const botToken = token();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

function cleanUsername(value?: string | null) {
  return (value ?? "").trim().replace(/^@/, "").toLowerCase();
}

function now() {
  return new Date().toISOString();
}

export async function ensureTelegramSchema() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS telegram_chats (
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
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS telegram_messages (
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
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS telegram_bot_state (
      id INTEGER PRIMARY KEY,
      last_update_id INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.execute("CREATE INDEX IF NOT EXISTS idx_telegram_chats_lead ON telegram_chats(lead_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_telegram_chats_manager ON telegram_chats(manager_id)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages(chat_id, created_at)");
  await repairOrphanTelegramChats();
}

async function repairOrphanTelegramChats() {
  const rows = await db.select().from(telegramChatsTable).where(eq(telegramChatsTable.status, "active"));
  const orphanChats = rows.filter((chat) => !chat.leadId);
  if (orphanChats.length === 0) return;

  const managerId = await getDefaultManagerId();
  for (const chat of orphanChats) {
    const [lead] = await db
      .insert(leadsTable)
      .values({
        clientName: chat.clientName.startsWith("⭐") ? chat.clientName : `⭐ ${chat.clientName}`,
        telegram: chat.telegramUsername ? `@${chat.telegramUsername}` : null,
        product: "Telegram",
        source: "Telegram bot",
        status: "new",
        notes: "Автоматически создано из существующего Telegram-чата без привязки к заявке.",
        managerId,
        createdAt: now(),
      })
      .returning();

    await db
      .update(telegramChatsTable)
      .set({
        leadId: lead.id,
        managerId,
        clientName: lead.clientName,
        updatedAt: now(),
      })
      .where(eq(telegramChatsTable.id, chat.id));

    await db.update(telegramMessagesTable).set({ leadId: lead.id }).where(eq(telegramMessagesTable.chatId, chat.id));
  }
}

export async function getBotUsername() {
  if (botUsername) return botUsername;
  if (!token()) return null;
  const response = await fetch(apiUrl("getMe"));
  const data: any = await response.json();
  if (!data.ok) return null;
  botUsername = data.result.username;
  return botUsername;
}

export async function getConnectLink(leadId: number) {
  const username = await getBotUsername();
  return username ? `https://t.me/${username}?start=lead_${leadId}` : null;
}

async function getCurrentUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user;
}

async function getDefaultManagerId() {
  const [vasya] = await db.select().from(usersTable).where(eq(usersTable.username, "vasya"));
  if (vasya) return vasya.id;
  const [firstUser] = await db.select().from(usersTable);
  if (!firstUser) throw new Error("No users found for Telegram lead");
  return firstUser.id;
}

async function getChatById(chatId: number) {
  const [chat] = await db.select().from(telegramChatsTable).where(eq(telegramChatsTable.id, chatId));
  return chat;
}

async function touchChat(chatId: number, text?: string | null) {
  await db
    .update(telegramChatsTable)
    .set({ lastMessageText: text ?? null, lastMessageAt: now(), updatedAt: now() })
    .where(eq(telegramChatsTable.id, chatId));
}

export async function ensureChatForLead(leadId: number, managerId?: number | null) {
  await ensureTelegramSchema();
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId));
  if (!lead) throw new Error("Lead not found");

  const [existing] = await db.select().from(telegramChatsTable).where(eq(telegramChatsTable.leadId, leadId));
  if (existing) return existing;

  const [chat] = await db
    .insert(telegramChatsTable)
    .values({
      leadId,
      managerId: managerId ?? lead.managerId,
      telegramUsername: cleanUsername(lead.telegram) || null,
      clientName: lead.clientName,
      status: "pending",
    })
    .returning();

  return chat;
}

async function findChatForIncoming(message: any) {
  const telegramChatId = String(message.chat.id);
  const [byChatId] = await db.select().from(telegramChatsTable).where(eq(telegramChatsTable.telegramChatId, telegramChatId));
  if (byChatId) return byChatId;

  const startMatch = String(message.text ?? "").match(/^\/start\s+lead_(\d+)/);
  if (startMatch) {
    const leadId = Number(startMatch[1]);
    const chat = await ensureChatForLead(leadId, null);
    const username = cleanUsername(message.from?.username) || chat.telegramUsername;
    const [updated] = await db
      .update(telegramChatsTable)
      .set({ telegramChatId, telegramUsername: username, status: "active", updatedAt: now() })
      .where(eq(telegramChatsTable.id, chat.id))
      .returning();
    return updated;
  }

  const username = cleanUsername(message.from?.username);
  if (username) {
    const candidates = await db.select().from(leadsTable);
    const lead = candidates.find((item) => cleanUsername(item.telegram) === username);
    if (lead) {
      const chat = await ensureChatForLead(lead.id, null);
      const [updated] = await db
        .update(telegramChatsTable)
        .set({ telegramChatId, telegramUsername: username, status: "active", updatedAt: now() })
        .where(eq(telegramChatsTable.id, chat.id))
        .returning();
      return updated;
    }
  }

  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || message.chat?.username || "Telegram клиент";
  const managerId = await getDefaultManagerId();
  const initialText =
    message.text ??
    message.caption ??
    (message.document?.file_name ? `Файл: ${message.document.file_name}` : message.photo ? "Фото" : "");
  const [lead] = await db
    .insert(leadsTable)
    .values({
      clientName: `⭐ ${name}`,
      telegram: username ? `@${username}` : null,
      product: "Telegram",
      source: "Telegram bot",
      status: "new",
      notes: ["Автоматически создано из входящего Telegram-чата без привязки к заявке.", initialText ? `Первое сообщение: ${initialText}` : ""]
        .filter(Boolean)
        .join("\n"),
      managerId,
      createdAt: now(),
    })
    .returning();
  const [created] = await db
    .insert(telegramChatsTable)
    .values({
      leadId: lead.id,
      managerId,
      telegramChatId,
      telegramUsername: username || null,
      clientName: `⭐ ${name}`,
      status: "active",
      lastMessageAt: now(),
    })
    .returning();
  return created;
}

async function saveIncomingMessage(chat: ChatRow, message: any) {
  const existing = await db
    .select({ id: telegramMessagesTable.id })
    .from(telegramMessagesTable)
    .where(eq(telegramMessagesTable.telegramMessageId, message.message_id));
  if (existing.length > 0) return;

  const text =
    message.text ??
    message.caption ??
    (message.document?.file_name ? `Файл: ${message.document.file_name}` : message.photo ? "Фото" : "");

  await db.insert(telegramMessagesTable).values({
    chatId: chat.id,
    leadId: chat.leadId,
    direction: "incoming",
    senderType: "client",
    telegramMessageId: message.message_id,
    text,
    attachmentName: message.document?.file_name ?? null,
    attachmentType: message.document?.mime_type ?? (message.photo ? "image/jpeg" : null),
    telegramFileId: message.document?.file_id ?? message.photo?.at(-1)?.file_id ?? null,
    status: "received",
    createdAt: message.date ? new Date(message.date * 1000).toISOString() : now(),
  });
  await touchChat(chat.id, text);
}

async function getLastUpdateId() {
  const [state] = await db.select().from(telegramBotStateTable).where(eq(telegramBotStateTable.id, 1));
  return state?.lastUpdateId ?? 0;
}

async function setLastUpdateId(updateId: number) {
  await client.execute({
    sql: `
      INSERT INTO telegram_bot_state (id, last_update_id, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET last_update_id = excluded.last_update_id, updated_at = CURRENT_TIMESTAMP
    `,
    args: [updateId],
  });
}

export async function pollTelegramUpdates() {
  if (!token()) return;
  await ensureTelegramSchema();
  const lastUpdateId = await getLastUpdateId();
  const response = await fetch(apiUrl(`getUpdates?timeout=0&offset=${lastUpdateId + 1}`));
  const data: any = await response.json();
  if (!data.ok) throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);

  let maxUpdateId = lastUpdateId;
  for (const update of data.result ?? []) {
    maxUpdateId = Math.max(maxUpdateId, update.update_id);
    const message = update.message;
    if (!message?.chat?.id) continue;
    const chat = await findChatForIncoming(message);
    await saveIncomingMessage(chat, message);
  }

  if (maxUpdateId > lastUpdateId) await setLastUpdateId(maxUpdateId);
}

export function startTelegramPolling() {
  if (pollingStarted || !token()) return;
  pollingStarted = true;
  setTimeout(() => void pollTelegramUpdates().catch((error) => logger.warn({ err: error }, "Telegram polling failed")), 2_000);
  setInterval(() => void pollTelegramUpdates().catch((error) => logger.warn({ err: error }, "Telegram polling failed")), POLL_INTERVAL_MS);
}

export async function listChats(userId: number) {
  await ensureTelegramSchema();
  const user = await getCurrentUser(userId);
  const rows = await client.execute({
    sql: `
      SELECT
        c.*,
        l.status AS lead_status,
        u.name AS manager_name,
        (SELECT COUNT(*) FROM telegram_messages m WHERE m.chat_id = c.id AND m.direction = 'incoming') AS incoming_count
      FROM telegram_chats c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN users u ON u.id = c.manager_id
      ${user?.role === "admin" ? "" : "WHERE c.manager_id = ?"}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `,
    args: user?.role === "admin" ? [] : [userId],
  });
  return rows.rows;
}

export async function getChatMessages(userId: number, chatId: number) {
  const chat = await getChatById(chatId);
  const user = await getCurrentUser(userId);
  if (!chat || (!user || (user.role !== "admin" && chat.managerId !== userId))) throw new Error("Chat not found");
  const messages = await db.select().from(telegramMessagesTable).where(eq(telegramMessagesTable.chatId, chatId));
  return messages.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export async function sendChatMessage(userId: number, chatId: number, text: string, file?: { name: string; type: string; dataBase64: string }) {
  const chat = await getChatById(chatId);
  const user = await getCurrentUser(userId);
  if (!chat || !user || (user.role !== "admin" && chat.managerId !== userId)) throw new Error("Chat not found");
  if (!chat.telegramChatId) throw new Error("Клиент еще не подключил Telegram-бота");

  let telegramMessageId: number | undefined;
  let attachmentPath: string | undefined;
  let telegramFileId: string | undefined;

  if (file?.dataBase64) {
    const uploadsDir = path.resolve(process.cwd(), "data", "uploads", "telegram");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const safeName = file.name.replace(/[^\w.\-а-яА-ЯёЁ ]/g, "_");
    attachmentPath = path.join(uploadsDir, `${Date.now()}-${safeName}`);
    const buffer = Buffer.from(file.dataBase64, "base64");
    fs.writeFileSync(attachmentPath, buffer);

    const form = new FormData();
    form.set("chat_id", chat.telegramChatId);
    if (text) form.set("caption", text);
    form.set("document", new Blob([buffer], { type: file.type || "application/octet-stream" }), file.name);
    const response = await fetch(apiUrl("sendDocument"), { method: "POST", body: form });
    const data: any = await response.json();
    if (!data.ok) throw new Error(data.description || "Telegram sendDocument failed");
    telegramMessageId = data.result.message_id;
    telegramFileId = data.result.document?.file_id;
  } else {
    const response = await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat.telegramChatId, text }),
    });
    const data: any = await response.json();
    if (!data.ok) throw new Error(data.description || "Telegram sendMessage failed");
    telegramMessageId = data.result.message_id;
  }

  const [message] = await db
    .insert(telegramMessagesTable)
    .values({
      chatId,
      leadId: chat.leadId,
      direction: "outgoing",
      senderType: "manager",
      senderId: userId,
      telegramMessageId,
      text: text || null,
      attachmentName: file?.name ?? null,
      attachmentType: file?.type ?? null,
      attachmentPath: attachmentPath ?? null,
      telegramFileId: telegramFileId ?? null,
      status: "sent",
      createdAt: now(),
    })
    .returning();
  await touchChat(chatId, text || file?.name || "Файл");
  return message;
}

export async function sendChatDocumentFromPath(userId: number, chatId: number, filePath: string, fileName: string, caption: string) {
  const chat = await getChatById(chatId);
  const user = await getCurrentUser(userId);
  if (!chat || !user || (user.role !== "admin" && chat.managerId !== userId)) throw new Error("Chat not found");
  if (!chat.telegramChatId) throw new Error("Клиент еще не подключил Telegram-бота");

  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.set("chat_id", chat.telegramChatId);
  form.set("caption", caption);
  form.set("document", new Blob([buffer], { type: "application/pdf" }), fileName);

  const response = await fetch(apiUrl("sendDocument"), { method: "POST", body: form });
  const data: any = await response.json();
  if (!data.ok) throw new Error(data.description || "Telegram sendDocument failed");

  const [message] = await db
    .insert(telegramMessagesTable)
    .values({
      chatId,
      leadId: chat.leadId,
      direction: "outgoing",
      senderType: "manager",
      senderId: userId,
      telegramMessageId: data.result.message_id,
      text: caption,
      attachmentName: fileName,
      attachmentType: "application/pdf",
      attachmentPath: filePath,
      telegramFileId: data.result.document?.file_id ?? null,
      status: "sent",
      createdAt: now(),
    })
    .returning();

  await touchChat(chatId, caption || fileName);
  return message;
}
