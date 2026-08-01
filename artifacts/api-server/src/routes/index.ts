import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leadsRouter from "./leads";
import paymentsRouter from "./payments";
import dashboardRouter from "./dashboard";
import planningRouter from "./planning";
import employeesRouter from "./employees";
import workspaceRouter from "./workspace";
import integrationsRouter from "./integrations";
import chatsRouter from "./chats";
import invoicesRouter from "./invoices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(leadsRouter);
router.use(paymentsRouter);
router.use(dashboardRouter);
router.use(planningRouter);
router.use(employeesRouter);
router.use(workspaceRouter);
router.use(integrationsRouter);
router.use(chatsRouter);
router.use(invoicesRouter);

export default router;
