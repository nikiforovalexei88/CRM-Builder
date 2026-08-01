import { Router, type IRouter } from "express";
import { syncGoogleSheetsLeads } from "../services/googleSheetsSync";

const router: IRouter = Router();

router.post("/integrations/google-sheets/sync", async (req, res): Promise<void> => {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await syncGoogleSheetsLeads();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Google Sheets sync failed" });
  }
});

export default router;
