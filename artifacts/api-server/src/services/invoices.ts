import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { client, db, eq, invoicesTable, leadsTable, telegramChatsTable } from "@workspace/db";
import { sendChatDocumentFromPath } from "./telegramChats";

type InvoiceInput = {
  leadId: number;
  managerId: number;
  clientName: string;
  amount: number;
  description: string;
};

const COMPANY = {
  name: 'ООО "CRM Консалтинг"',
  inn: "7701234567",
  kpp: "770101001",
  ogrn: "1237700000000",
  bank: 'АО "Тест Банк"',
  bik: "044525000",
  account: "40702810900000000001",
  corr: "30101810400000000225",
};

function invoicesDir() {
  const dir = path.resolve(process.cwd(), "data", "invoices");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fontPath() {
  const arial = "C:\\Windows\\Fonts\\arial.ttf";
  return fs.existsSync(arial) ? arial : null;
}

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

export async function ensureInvoiceSchema() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
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
  `);
  await client.execute("CREATE INDEX IF NOT EXISTS idx_invoices_lead ON invoices(lead_id, created_at)");
  await client.execute("CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)");
}

function nextInvoiceNumber() {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `INV-${stamp}`;
}

export function generateInvoicePdf(input: InvoiceInput & { invoiceNumber?: string }) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const selectedFont = fontPath();
  if (selectedFont) doc.font(selectedFont);

  doc.on("data", (chunk) => chunks.push(chunk));

  const invoiceNumber = input.invoiceNumber ?? "PREVIEW";
  const created = new Date().toLocaleDateString("ru-RU");

  doc.fontSize(20).text(`Счет на оплату N ${invoiceNumber}`, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`Дата: ${created}`, { align: "right" });
  doc.moveDown();

  doc.fontSize(13).text("Поставщик", { underline: true });
  doc.fontSize(10).text(`${COMPANY.name}`);
  doc.text(`ИНН ${COMPANY.inn} / КПП ${COMPANY.kpp}`);
  doc.text(`ОГРН ${COMPANY.ogrn}`);
  doc.text(`Банк: ${COMPANY.bank}`);
  doc.text(`БИК ${COMPANY.bik}`);
  doc.text(`Р/с ${COMPANY.account}`);
  doc.text(`К/с ${COMPANY.corr}`);
  doc.moveDown();

  doc.fontSize(13).text("Покупатель", { underline: true });
  doc.fontSize(10).text(input.clientName);
  doc.moveDown();

  const y = doc.y + 8;
  doc.rect(48, y, 500, 24).fill("#f1f5f9").stroke();
  doc.fillColor("#000").fontSize(10);
  doc.text("Описание", 58, y + 7, { width: 300 });
  doc.text("Сумма", 440, y + 7, { width: 90, align: "right" });
  const rowY = y + 24;
  doc.rect(48, rowY, 500, 72).stroke();
  doc.text(input.description, 58, rowY + 10, { width: 330 });
  doc.text(money(input.amount), 400, rowY + 10, { width: 130, align: "right" });
  doc.moveDown(6);

  doc.fontSize(13).text(`Итого к оплате: ${money(input.amount)}`, { align: "right" });
  doc.moveDown(2);
  doc.fontSize(10).text("Назначение платежа: оплата образовательных/консультационных услуг по счету.", { align: "left" });
  doc.moveDown(3);
  doc.text("Руководитель __________________ / Иванов И.И. /");
  doc.text("М.П.");
  doc.moveDown(2);
  doc.fontSize(9).fillColor("#64748b").text("Тестовая форма счета. Реквизиты компании случайные и используются для проверки CRM.", { align: "center" });

  doc.end();
  return new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function listInvoicesForLead(leadId: number) {
  await ensureInvoiceSchema();
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.leadId, leadId));
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function previewInvoicePdf(input: InvoiceInput) {
  return generateInvoicePdf(input);
}

export async function createInvoice(input: InvoiceInput) {
  await ensureInvoiceSchema();
  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, input.leadId));
  if (!lead) throw new Error("Lead not found");
  const [chat] = await db.select().from(telegramChatsTable).where(eq(telegramChatsTable.leadId, input.leadId));
  const invoiceNumber = nextInvoiceNumber();
  const pdf = await generateInvoicePdf({ ...input, invoiceNumber });
  const pdfPath = path.join(invoicesDir(), `${invoiceNumber}.pdf`);
  fs.writeFileSync(pdfPath, pdf);

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      leadId: input.leadId,
      chatId: chat?.id ?? null,
      managerId: input.managerId,
      invoiceNumber,
      clientName: input.clientName,
      amount: input.amount,
      description: input.description,
      status: "saved",
      pdfPath,
    })
    .returning();
  return invoice;
}

export async function getInvoiceFile(invoiceId: number) {
  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!invoice?.pdfPath) throw new Error("Invoice PDF not found");
  const fileName = `${invoice.invoiceNumber}.pdf`;
  const fallbackPath = path.join(invoicesDir(), path.basename(invoice.pdfPath));
  const filePath = fs.existsSync(invoice.pdfPath) ? invoice.pdfPath : fallbackPath;
  if (!fs.existsSync(filePath)) throw new Error("Invoice PDF not found");
  return { invoice, filePath, fileName };
}

export async function sendInvoiceToTelegram(userId: number, invoiceId: number) {
  const { invoice, filePath, fileName } = await getInvoiceFile(invoiceId);
  if (!invoice.chatId) throw new Error("Для заявки нет Telegram-чата");
  await sendChatDocumentFromPath(userId, invoice.chatId, filePath, fileName, `Счет на оплату ${invoice.invoiceNumber}: ${money(invoice.amount)}`);
  const [updated] = await db
    .update(invoicesTable)
    .set({ status: "sent", sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(invoicesTable.id, invoiceId))
    .returning();
  return updated;
}
