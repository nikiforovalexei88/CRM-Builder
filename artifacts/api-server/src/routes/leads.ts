import { Router, type IRouter } from "express";
import { db, leadsTable, usersTable, paymentsTable, activitiesTable } from "@workspace/db";
import { eq, and, ilike, or, SQL } from "drizzle-orm";
import {
  CreateLeadBody,
  CreateLeadResponse,
  GetLeadParams,
  GetLeadResponse,
  UpdateLeadParams,
  UpdateLeadBody,
  UpdateLeadResponse,
  DeleteLeadParams,
  ListLeadsResponse,
  ListLeadsQueryParams,
  MoveLeadParams,
  MoveLeadBody,
  MoveLeadResponse,
  AddLeadNoteParams,
  AddLeadNoteBody,
  AddLeadNoteResponse,
  ListLeadActivitiesParams,
  ListLeadActivitiesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

async function getUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user;
}

async function enrichLead(lead: any, users: any[]) {
  const manager = users.find(u => u.id === lead.managerId);
  return { ...lead, managerName: manager?.name ?? null };
}

router.get("/leads", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = ListLeadsQueryParams.safeParse(req.query);
  const filters = params.success ? params.data : {};

  const conditions: SQL[] = [];

  // Managers can only see their own leads
  if (user.role !== "admin") {
    conditions.push(eq(leadsTable.managerId, user.id));
  } else if (filters.managerId) {
    conditions.push(eq(leadsTable.managerId, Number(filters.managerId)));
  }

  if (filters.status) conditions.push(eq(leadsTable.status, filters.status));
  if (filters.tariff) conditions.push(eq(leadsTable.tariff, filters.tariff));
  if (filters.search) {
    conditions.push(
      or(
        ilike(leadsTable.clientName, `%${filters.search}%`),
        ilike(leadsTable.phone ?? leadsTable.clientName, `%${filters.search}%`),
        ilike(leadsTable.telegram ?? leadsTable.clientName, `%${filters.search}%`),
      )!
    );
  }

  if (filters.month) {
    // filter by month from paymentDate or createdAt
    conditions.push(ilike(leadsTable.paymentDate ?? leadsTable.status, `${filters.month}%`));
  }

  const leads = conditions.length > 0
    ? await db.select().from(leadsTable).where(and(...conditions)).orderBy(leadsTable.createdAt)
    : await db.select().from(leadsTable).orderBy(leadsTable.createdAt);

  const users = await db.select().from(usersTable);
  const enriched = await Promise.all(leads.map(l => enrichLead(l, users)));

  res.json(ListLeadsResponse.parse(enriched));
});

router.post("/leads", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [lead] = await db.insert(leadsTable).values(parsed.data).returning();
  const users = await db.select().from(usersTable);
  const enriched = await enrichLead(lead, users);

  res.status(201).json(CreateLeadResponse.parse(enriched));
});

router.get("/leads/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = GetLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  if (user.role !== "admin" && lead.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const users = await db.select().from(usersTable);
  const enriched = await enrichLead(lead, users);

  res.json(GetLeadResponse.parse(enriched));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (user.role !== "admin" && existing.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const updateData: Record<string, any> = { ...parsed.data };
  delete updateData.managerId; // prevent reassignment by managers

  const [lead] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, params.data.id)).returning();
  const users = await db.select().from(usersTable);
  const enriched = await enrichLead(lead, users);

  res.json(UpdateLeadResponse.parse(enriched));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (user.role !== "admin" && existing.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/leads/:id/move", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = MoveLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = MoveLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }
  if (user.role !== "admin" && existing.managerId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const [lead] = await db.update(leadsTable)
    .set({ status: parsed.data.status })
    .where(eq(leadsTable.id, params.data.id))
    .returning();

  // Auto-create payment when moving to "paid"
  if (parsed.data.status === "paid" && existing.status !== "paid" && lead.price) {
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(paymentsTable).values({
      clientName: lead.clientName,
      telegram: lead.telegram ?? undefined,
      tariff: lead.tariff ?? "куратор",
      revenue: lead.price,
      netProfit: lead.netProfit ?? undefined,
      paymentMethod: lead.paymentType ?? undefined,
      paymentDate: lead.paymentDate ?? today,
      managerId: lead.managerId,
      status: "paid",
    });
    // Log activity
    await db.insert(activitiesTable).values({
      leadId: lead.id,
      content: "Лид переведен в статус Оплачено. Платеж создан автоматически.",
      authorId: userId,
    });
  }

  // Log status change
  await db.insert(activitiesTable).values({
    leadId: lead.id,
    content: `Статус изменен на: ${parsed.data.status}`,
    authorId: userId,
  });

  const users = await db.select().from(usersTable);
  const enriched = await enrichLead(lead, users);
  res.json(MoveLeadResponse.parse(enriched));
});

router.post("/leads/:id/notes", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = AddLeadNoteParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AddLeadNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Lead not found" }); return; }

  const [activity] = await db.insert(activitiesTable).values({
    leadId: params.data.id,
    content: parsed.data.content,
    authorId: userId,
  }).returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.status(201).json(AddLeadNoteResponse.parse({
    id: activity.id,
    leadId: activity.leadId,
    content: activity.content,
    authorName: author?.name ?? null,
    createdAt: activity.createdAt.toISOString(),
  }));
});

router.get("/leads/:id/activities", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = ListLeadActivitiesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const activities = await db.select().from(activitiesTable)
    .where(eq(activitiesTable.leadId, params.data.id))
    .orderBy(activitiesTable.createdAt);

  const users = await db.select().from(usersTable);
  const enriched = activities.map(a => ({
    id: a.id,
    leadId: a.leadId,
    content: a.content,
    authorName: a.authorId ? (users.find(u => u.id === a.authorId)?.name ?? null) : null,
    createdAt: a.createdAt.toISOString(),
  }));

  res.json(ListLeadActivitiesResponse.parse(enriched));
});

export default router;
