import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import XLSX from "xlsx";
import { closeDb, db, eq, leadsTable, paymentsTable, plansTable, usersTable } from "@workspace/db";

type AppUser = typeof usersTable.$inferSelect;

const EXCEL_SOURCE = "Excel: Запуск январь-февраль";
const rootDir = path.resolve(import.meta.dirname, "..", "..");
const workbookFileName = "Запуск январь-февраль.xlsx";

function findWorkbookPath() {
  if (process.env.EXCEL_FILE && fs.existsSync(process.env.EXCEL_FILE)) {
    return process.env.EXCEL_FILE;
  }

  const rootCandidate = path.join(rootDir, workbookFileName);
  if (fs.existsSync(rootCandidate)) return rootCandidate;

  throw new Error(`Excel file "${workbookFileName}" not found in ${rootDir}`);
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function numberValue(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  let text = clean(value).replace(/[^\d,.-]/g, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/,/g, "");
  } else if (text.includes(",") && !text.includes(".")) {
    text = text.replace(",", ".");
  }
  text = text.replace(/(?!^)-/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function excelDate(value: unknown, fallbackYear = 2026): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = clean(value);
  const match = text.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearRaw = match[3] ? Number(match[3]) : fallbackYear;
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return text || undefined;
}

function normalizeTariff(value: unknown): string | undefined {
  const text = clean(value).toLowerCase();
  if (!text) return undefined;
  if (text.includes("vip") || text.includes("вип")) return "вип";
  if (text.includes("куратор")) return "куратор";
  if (text.includes("сам")) return "сам";
  if (text.includes("васил")) return "с Василием";
  if (text.includes("конс")) return "1 конс";
  return text;
}

function normalizePaymentMethod(value: unknown): string | undefined {
  const text = clean(value).toLowerCase();
  if (!text) return undefined;
  if (text.includes("расс")) return "рассрочка";
  if (text.includes("сразу")) return "сразу";
  if (text.includes("счет") || text.includes("счёт")) return "счет";
  return text;
}

function normalizeLeadStatus(status: unknown, price?: number): string {
  const text = clean(status).toLowerCase();
  if (price || /купил|купила|купили|оплат|успеш/.test(text)) return "paid";
  if (/отказ|игнор|не готов|нет денег|не интерес|не сейчас|не подош|дорого|тотал/.test(text)) return "lost";
  if (/кп|през|коммерч/.test(text)) return "proposal_sent";
  if (/ждет|ждёт|дума|решени|таймаут|дедлайн/.test(text)) return "waiting_decision";
  if (/звон|созвон|диалог|касани|ндз|смс|коннект|конект|процесс|работ/.test(text)) return "in_progress";
  return "new";
}

function managerUsername(value: unknown): "vasya" | "alina" | "pasha" {
  const text = clean(value).toLowerCase();
  if (text.includes("алин")) return "alina";
  if (text.includes("паш")) return "pasha";
  return "vasya";
}

async function upsertUser(input: {
  name: string;
  username: string;
  role: "admin" | "manager";
  password: string;
  salary: number;
  baseBonus: number;
  multiplier: number;
  minPlan: number;
  targetPlan: number;
  maxPlan: number;
}) {
  const values = {
    name: input.name,
    role: input.role,
    username: input.username,
    passwordHash: await bcrypt.hash(input.password, 10),
    salary: input.salary,
    baseBonus: input.baseBonus,
    multiplier: input.multiplier,
    minPlan: input.minPlan,
    targetPlan: input.targetPlan,
    maxPlan: input.maxPlan,
  };

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, input.username));
  if (existing) {
    const [updated] = await db.update(usersTable).set(values).where(eq(usersTable.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(usersTable).values(values).returning();
  return created;
}

async function ensureUsers() {
  const users = await Promise.all([
    upsertUser({
      name: "Вася",
      username: "vasya",
      role: "admin",
      password: "vasya123",
      salary: 150_000,
      baseBonus: 80_000,
      multiplier: 1,
      minPlan: 1_000_000,
      targetPlan: 1_500_000,
      maxPlan: 2_000_000,
    }),
    upsertUser({
      name: "Алина",
      username: "alina",
      role: "manager",
      password: "alina123",
      salary: 100_000,
      baseBonus: 50_000,
      multiplier: 1,
      minPlan: 1_000_000,
      targetPlan: 1_500_000,
      maxPlan: 1_875_000,
    }),
    upsertUser({
      name: "Паша",
      username: "pasha",
      role: "manager",
      password: "pasha123",
      salary: 100_000,
      baseBonus: 50_000,
      multiplier: 1,
      minPlan: 1_000_000,
      targetPlan: 1_500_000,
      maxPlan: 1_875_000,
    }),
  ]);

  return Object.fromEntries(users.map((user) => [user.username, user])) as Record<"vasya" | "alina" | "pasha", AppUser>;
}

function readRows(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
}

async function importLeadSheet(rows: unknown[][], manager: AppUser, sheetName: "Лиды Паша" | "Лиды Алина") {
  const isAlina = sheetName === "Лиды Алина";
  const leads = rows
    .slice(1)
    .map((row, index) => {
      const rowNumber = index + 2;
      const clientName = clean(row[isAlina ? 1 : 3]);
      const request = clean(row[isAlina ? 5 : 5]);
      const statusText = clean(row[isAlina ? 6 : 6]);
      const comment = clean(row[isAlina ? 12 : 11]);
      const action = clean(row[isAlina ? 14 : 11]);
      const price = numberValue(row[isAlina ? 8 : 8]);
      const netProfit = numberValue(row[isAlina ? 9 : 9]);

      if (!clientName && !request && !statusText) return null;

      const notes = [
        `[excel-import:${sheetName}:${rowNumber}]`,
        request && `Запрос: ${request}`,
        statusText && `Статус из Excel: ${statusText}`,
        comment && `Комментарий: ${comment}`,
        action && action !== comment && `Действие: ${action}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        clientName: clientName || `Без имени ${sheetName} ${rowNumber}`,
        phone: clean(row[isAlina ? 2 : 1]) || undefined,
        telegram: clean(row[isAlina ? 3 : 2]) || undefined,
        product: "Финансовое обучение",
        tariff: normalizeTariff(row[isAlina ? 7 : 7]),
        price,
        netProfit,
        source: EXCEL_SOURCE,
        income: clean(row[isAlina ? 4 : 4]) || undefined,
        status: normalizeLeadStatus(statusText, price),
        notes,
        managerId: manager.id,
        paymentDate: excelDate(row[isAlina ? 11 : 0]),
        paymentType: normalizePaymentMethod(row[isAlina ? 10 : 10]),
      };
    })
    .filter((lead): lead is NonNullable<typeof lead> => Boolean(lead));

  if (leads.length > 0) await db.insert(leadsTable).values(leads);
  return leads.length;
}

async function importPayments(rows: unknown[][], users: Record<"vasya" | "alina" | "pasha", AppUser>) {
  const payments = rows
    .slice(1)
    .map((row) => {
      const clientName = clean(row[1]);
      const revenue = numberValue(row[4]);
      const paymentDate = excelDate(row[8], 2025);
      if (!clientName || !revenue || !paymentDate) return null;

      const manager = users[managerUsername(row[9])];
      const orderNumber = numberValue(row[0]);

      return {
        orderNumber: orderNumber ? Math.trunc(orderNumber) : undefined,
        clientName,
        telegram: clean(row[2]) || undefined,
        tariff: normalizeTariff(row[3]) || "сам",
        revenue,
        netProfit: numberValue(row[5]),
        receivable: numberValue(row[6]),
        paymentMethod: normalizePaymentMethod(row[7]),
        paymentDate,
        managerId: manager.id,
        paymentSchedule: clean(row[10]) || `[excel-import] ${clean(row[9]) || "ОП"}`,
        status: "paid",
      };
    })
    .filter((payment): payment is NonNullable<typeof payment> => Boolean(payment));

  if (payments.length > 0) await db.insert(paymentsTable).values(payments);
  return payments.length;
}

async function importPlans(rows: unknown[][], users: Record<"vasya" | "alina" | "pasha", AppUser>) {
  const managerRow = rows[1] ?? [];
  const minRow = rows.find((row) => clean(row[0]).toLowerCase() === "план минимум") ?? [];
  const targetRow = rows.find((row) => clean(row[0]).toLowerCase() === "план целевой") ?? [];
  const plans = [];

  for (let col = 1; col <= 3; col++) {
    const manager = users[managerUsername(managerRow[col])];
    const minPlan = numberValue(minRow[col]) ?? manager.minPlan ?? 0;
    const targetPlan = numberValue(targetRow[col]) ?? manager.targetPlan ?? 0;
    if (!manager || !targetPlan) continue;

    for (const month of ["2026-01", "2026-02"]) {
      plans.push({
        managerId: manager.id,
        month,
        product: EXCEL_SOURCE,
        minPlan,
        targetPlan,
        maxPlan: Math.round(targetPlan * 1.25),
      });
    }
  }

  if (plans.length > 0) await db.insert(plansTable).values(plans);
  return plans.length;
}

async function main() {
  const workbookPath = findWorkbookPath();
  const workbook = XLSX.readFile(workbookPath);
  const users = await ensureUsers();

  const pashaLeads = await importLeadSheet(readRows(workbook, "Лиды Паша"), users.pasha, "Лиды Паша");
  const alinaLeads = await importLeadSheet(readRows(workbook, "Лиды Алина"), users.alina, "Лиды Алина");
  const payments = await importPayments(readRows(workbook, "Оплаты"), users);
  const plans = await importPlans(readRows(workbook, "дашборд"), users);

  console.log(`Workbook: ${workbookPath}`);
  console.log("Users: Вася / vasya123, Алина / alina123, Паша / pasha123");
  console.log(`Imported leads: ${pashaLeads + alinaLeads} (${pashaLeads} Pasha, ${alinaLeads} Alina)`);
  console.log(`Imported payments: ${payments}`);
  console.log(`Imported plans: ${plans}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeDb();
  });
