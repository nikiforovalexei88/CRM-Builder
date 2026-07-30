import { Router, type IRouter } from "express";
import { db, usersTable, leadsTable, paymentsTable, plansTable } from "@workspace/db";
import { eq, and, ne, ilike, SQL } from "drizzle-orm";
import {
  GetMyStatsResponse,
  GetMyStatsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

router.get("/workspace/my-stats", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = GetMyStatsQueryParams.safeParse(req.query);
  const month = params.success ? params.data.month : undefined;

  // Open deals (not paid or closed)
  const allLeads = await db.select().from(leadsTable).where(eq(leadsTable.managerId, userId));
  const openDeals = allLeads.filter(l => l.status !== "paid").length;

  // Payments this month
  const paymentConditions: SQL[] = [eq(paymentsTable.managerId, userId)];
  if (month) paymentConditions.push(ilike(paymentsTable.paymentDate, `${month}%`));

  const myPayments = await db.select().from(paymentsTable).where(and(...paymentConditions));
  const netProfit = myPayments.reduce((s, p) => s + (p.netProfit ?? 0), 0);

  // Plans
  const planConditions: SQL[] = [eq(plansTable.managerId, userId)];
  if (month) planConditions.push(eq(plansTable.month, month));

  const plans = await db.select().from(plansTable).where(and(...planConditions));
  const targetPlan = plans.length > 0 ? plans[0].targetPlan : (user.targetPlan ?? 1500000);
  const minPlan = plans.length > 0 ? plans[0].minPlan : (user.minPlan ?? 1000000);
  const planProgress = targetPlan > 0 ? (netProfit / targetPlan) * 100 : 0;

  // Bonus calculation: no bonus before minimum, base bonus after minimum,
  // multiplied bonus after target.
  const targetMultiplier = user.multiplier ?? 1;
  const baseBonus = user.baseBonus ?? 0;
  const currentMultiplier = netProfit >= targetPlan ? targetMultiplier : netProfit >= minPlan ? 1 : 0;
  const currentBonus = baseBonus * currentMultiplier;
  const amountToTarget = Math.max(0, targetPlan - netProfit);

  // Today tasks = leads in "in_progress" status
  const todayTasks = allLeads.filter(l => l.status === "in_progress").length;

  res.json(GetMyStatsResponse.parse({
    managerId: user.id,
    managerName: user.name,
    openDeals,
    todayTasks,
    currentBonus,
    amountToTarget,
    currentMultiplier,
    netProfit,
    targetPlan,
    minPlan,
    planProgress,
  }));
});

export default router;
