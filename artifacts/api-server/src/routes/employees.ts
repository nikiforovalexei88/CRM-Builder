import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  CreateEmployeeBody,
  CreateEmployeeResponse,
  GetEmployeeParams,
  GetEmployeeResponse,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  UpdateEmployeeResponse,
  DeleteEmployeeParams,
  ListEmployeesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

async function requireAdmin(req: any, res: any, userId: number): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function formatEmployee(user: any) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    username: user.username,
    salary: user.salary ?? null,
    baseBonus: user.baseBonus ?? null,
    multiplier: user.multiplier ?? null,
    minPlan: user.minPlan ?? null,
    targetPlan: user.targetPlan ?? null,
    maxPlan: user.maxPlan ?? null,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
  };
}

router.get("/employees", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(ListEmployeesResponse.parse(users.map(formatEmployee)));
});

router.post("/employees", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  if (!(await requireAdmin(req, res, userId))) return;

  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(usersTable).values({ ...rest, passwordHash }).returning();
  res.status(201).json(CreateEmployeeResponse.parse(formatEmployee(user)));
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "Employee not found" }); return; }

  res.json(GetEmployeeResponse.parse(formatEmployee(user)));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  if (!(await requireAdmin(req, res, userId))) return;

  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }

  const updateData: Record<string, any> = { ...parsed.data };
  if (updateData.password) {
    updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
    delete updateData.password;
  } else {
    delete updateData.password;
  }

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, params.data.id)).returning();
  res.json(UpdateEmployeeResponse.parse(formatEmployee(user)));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  if (!(await requireAdmin(req, res, userId))) return;

  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
