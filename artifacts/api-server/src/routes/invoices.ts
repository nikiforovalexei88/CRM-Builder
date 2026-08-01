import { Router, type IRouter } from "express";
import { createInvoice, getInvoiceFile, listInvoicesForLead, previewInvoicePdf, sendInvoiceToTelegram } from "../services/invoices";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function body(req: any, userId: number) {
  return {
    leadId: Number(req.body.leadId),
    managerId: userId,
    clientName: String(req.body.clientName ?? "").trim(),
    amount: Number(req.body.amount),
    description: String(req.body.description ?? "").trim(),
  };
}

router.get("/leads/:leadId/invoices", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  res.json(await listInvoicesForLead(Number(req.params.leadId)));
});

router.post("/invoices/preview", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const input = body(req, userId);
  const pdf = await previewInvoicePdf(input);
  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", "attachment; filename=invoice-preview.pdf");
  res.send(pdf);
});

router.post("/invoices", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.status(201).json(await createInvoice(body(req, userId)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invoice was not created" });
  }
});

router.get("/invoices/:id/pdf", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { filePath, fileName } = await getInvoiceFile(Number(req.params.id));
    res.download(filePath, fileName);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Invoice not found" });
  }
});

router.post("/invoices/:id/send-telegram", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(await sendInvoiceToTelegram(userId, Number(req.params.id)));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invoice was not sent" });
  }
});

export default router;
