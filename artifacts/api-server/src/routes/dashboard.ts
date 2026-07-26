import { Router, type IRouter } from "express";
import { db, paymentsTable, leadsTable, usersTable, plansTable } from "@workspace/db";
import { eq, ilike, and, SQL } from "drizzle-orm";
import {
  GetDashboardStatsResponse,
  GetDashboardStatsQueryParams,
  GetCashFlowResponse,
  GetManagerComparisonResponse,
  GetManagerComparisonQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return null; }
  return userId;
}

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = GetDashboardStatsQueryParams.safeParse(req.query);
  const month = params.success ? params.data.month : undefined;

  const conditions: SQL[] = [];
  if (month) conditions.push(ilike(paymentsTable.paymentDate, `${month}%`));

  const payments = conditions.length > 0
    ? await db.select().from(paymentsTable).where(and(...conditions))
    : await db.select().from(paymentsTable);

  const leads = await db.select().from(leadsTable);
  const plans = await db.select().from(plansTable);

  const totalRevenue = payments.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const totalNetProfit = payments.reduce((s, p) => s + (p.netProfit ?? 0), 0);
  const totalDeals = payments.length;
  const totalLeads = leads.length;
  const conversionRate = totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0;
  const averageCheck = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  // Sum plans for the given month or all time
  const monthPlans = month ? plans.filter(p => p.month === month) : plans;
  const minPlan = monthPlans.reduce((s, p) => s + p.minPlan, 0);
  const targetPlan = monthPlans.reduce((s, p) => s + p.targetPlan, 0);
  const planProgress = targetPlan > 0 ? (totalNetProfit / targetPlan) * 100 : 0;

  res.json(GetDashboardStatsResponse.parse({
    totalRevenue,
    totalNetProfit,
    totalDeals,
    conversionRate,
    averageCheck,
    totalLeads,
    minPlan,
    targetPlan,
    planProgress,
  }));
});

router.get("/dashboard/cash-flow", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const payments = await db.select().from(paymentsTable);

  // Group by month (YYYY-MM)
  const byMonth: Record<string, { revenue: number; netProfit: number; deals: number }> = {};
  for (const p of payments) {
    const month = p.paymentDate?.slice(0, 7) ?? "unknown";
    if (!byMonth[month]) byMonth[month] = { revenue: 0, netProfit: 0, deals: 0 };
    byMonth[month].revenue += p.revenue ?? 0;
    byMonth[month].netProfit += p.netProfit ?? 0;
    byMonth[month].deals += 1;
  }

  const result = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  res.json(GetCashFlowResponse.parse(result));
});

router.get("/dashboard/manager-comparison", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const params = GetManagerComparisonQueryParams.safeParse(req.query);
  const month = params.success ? params.data.month : undefined;

  const users = await db.select().from(usersTable);
  const managers = users.filter(u => u.role !== "admin" || true); // include all

  const conditions: SQL[] = [];
  if (month) conditions.push(ilike(paymentsTable.paymentDate, `${month}%`));

  const payments = conditions.length > 0
    ? await db.select().from(paymentsTable).where(and(...conditions))
    : await db.select().from(paymentsTable);

  const plans = await db.select().from(plansTable);

  const result = managers.map(manager => {
    const managerPayments = payments.filter(p => p.managerId === manager.id);
    const revenue = managerPayments.reduce((s, p) => s + (p.revenue ?? 0), 0);
    const netProfit = managerPayments.reduce((s, p) => s + (p.netProfit ?? 0), 0);
    const deals = managerPayments.length;

    const managerPlans = month
      ? plans.filter(p => p.managerId === manager.id && p.month === month)
      : plans.filter(p => p.managerId === manager.id);

    const minPlan = managerPlans.length > 0 ? managerPlans[0].minPlan : (manager.minPlan ?? 1000000);
    const targetPlan = managerPlans.length > 0 ? managerPlans[0].targetPlan : (manager.targetPlan ?? 1500000);
    const planProgress = targetPlan > 0 ? (netProfit / targetPlan) * 100 : 0;

    return {
      managerId: manager.id,
      managerName: manager.name,
      revenue,
      netProfit,
      deals,
      minPlan,
      targetPlan,
      planProgress,
    };
  });

  res.json(GetManagerComparisonResponse.parse(result));
});

export default router;
