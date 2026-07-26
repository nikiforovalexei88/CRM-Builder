import { Router, type IRouter } from "express";
import { db, plansTable, usersTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import {
  CreatePlanBody,
  CreatePlanResponse,
  UpdatePlanParams,
  UpdatePlanBody,
  UpdatePlanResponse,
  ListPlansResponse,
  ListPlansQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

async function enrichPlan(plan: any, users: any[]) {
  const manager = users.find(u => u.id === plan.managerId);
  return {
    ...plan,
    managerName: manager?.name ?? null,
    createdAt: plan.createdAt instanceof Date ? plan.createdAt.toISOString() : plan.createdAt,
  };
}

router.get("/planning", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = ListPlansQueryParams.safeParse(req.query);
  const filters = params.success ? params.data : {};

  const conditions: SQL[] = [];
  if (filters.managerId) conditions.push(eq(plansTable.managerId, Number(filters.managerId)));
  if (filters.month) conditions.push(eq(plansTable.month, filters.month));

  const plans = conditions.length > 0
    ? await db.select().from(plansTable).where(and(...conditions)).orderBy(plansTable.month)
    : await db.select().from(plansTable).orderBy(plansTable.month);

  const users = await db.select().from(usersTable);
  const enriched = await Promise.all(plans.map(p => enrichPlan(p, users)));

  res.json(ListPlansResponse.parse(enriched));
});

router.post("/planning", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [plan] = await db.insert(plansTable).values(parsed.data).returning();
  const users = await db.select().from(usersTable);

  res.status(201).json(CreatePlanResponse.parse(await enrichPlan(plan, users)));
});

router.patch("/planning/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = UpdatePlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(plansTable).where(eq(plansTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Plan not found" }); return; }

  const [plan] = await db.update(plansTable).set(parsed.data).where(eq(plansTable.id, params.data.id)).returning();
  const users = await db.select().from(usersTable);

  res.json(UpdatePlanResponse.parse(await enrichPlan(plan, users)));
});

export default router;
