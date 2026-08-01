import { Router, type IRouter } from "express";
import { db, paymentsTable, usersTable } from "@workspace/db";
import { eq, and, like, type SQL } from "@workspace/db";
import {
  CreatePaymentBody,
  CreatePaymentResponse,
  GetPaymentParams,
  GetPaymentResponse,
  UpdatePaymentParams,
  UpdatePaymentBody,
  UpdatePaymentResponse,
  DeletePaymentParams,
  ListPaymentsResponse,
  ListPaymentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

async function getUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user;
}

function formatDate(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

function enrichPayment(payment: any, users: any[]) {
  const manager = users.find(u => u.id === payment.managerId);
  return {
    ...payment,
    managerName: manager?.name ?? null,
    createdAt: formatDate(payment.createdAt),
  };
}

router.get("/payments", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = ListPaymentsQueryParams.safeParse(req.query);
  const filters = params.success ? params.data : {};

  const conditions: SQL[] = [];

  if (user.role !== "admin") {
    conditions.push(eq(paymentsTable.managerId, user.id));
  } else if (filters.managerId) {
    conditions.push(eq(paymentsTable.managerId, Number(filters.managerId)));
  }

  if (filters.tariff) conditions.push(eq(paymentsTable.tariff, filters.tariff));
  if (filters.paymentMethod) conditions.push(eq(paymentsTable.paymentMethod, filters.paymentMethod));
  if (filters.status) conditions.push(eq(paymentsTable.status, filters.status));
  if (filters.search) conditions.push(like(paymentsTable.clientName, `%${filters.search}%`));
  if (filters.month) conditions.push(like(paymentsTable.paymentDate, `${filters.month}%`));

  const payments = conditions.length > 0
    ? await db.select().from(paymentsTable).where(and(...conditions)).orderBy(paymentsTable.paymentDate)
    : await db.select().from(paymentsTable).orderBy(paymentsTable.paymentDate);

  const users = await db.select().from(usersTable);
  const enriched = payments.map(p => enrichPayment(p, users));

  res.json(ListPaymentsResponse.parse(enriched));
});

router.post("/payments", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [payment] = await db.insert(paymentsTable).values(parsed.data).returning();
  const users = await db.select().from(usersTable);

  res.status(201).json(CreatePaymentResponse.parse(enrichPayment(payment, users)));
});

router.get("/payments/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = GetPaymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }

  if (user.role !== "admin" && payment.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const users = await db.select().from(usersTable);
  res.json(GetPaymentResponse.parse(enrichPayment(payment, users)));
});

router.patch("/payments/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = UpdatePaymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdatePaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }
  if (user.role !== "admin" && existing.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [payment] = await db.update(paymentsTable).set(parsed.data).where(eq(paymentsTable.id, params.data.id)).returning();
  const users = await db.select().from(usersTable);
  res.json(UpdatePaymentResponse.parse(enrichPayment(payment, users)));
});

router.delete("/payments/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = DeletePaymentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }
  if (user.role !== "admin" && existing.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(paymentsTable).where(eq(paymentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
