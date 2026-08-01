import { Router, type IRouter } from "express";
import { ensureChatForLead, getChatMessages, getConnectLink, listChats, sendChatMessage } from "../services/telegramChats";

const router: IRouter = Router();

function requireAuth(req: any, res: any): number | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

router.get("/chats", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  res.json(await listChats(userId));
});

router.post("/chats/from-lead/:leadId", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const leadId = Number(req.params.leadId);
  const chat = await ensureChatForLead(leadId, userId);
  const connectLink = await getConnectLink(leadId);
  res.json({ ...chat, connectLink });
});

router.get("/chats/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    res.json(await getChatMessages(userId, Number(req.params.id)));
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Chat not found" });
  }
});

router.post("/chats/:id/messages", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { text = "", file } = req.body ?? {};
    if (!String(text).trim() && !file?.dataBase64) {
      res.status(400).json({ error: "Message text or file is required" });
      return;
    }
    res.status(201).json(await sendChatMessage(userId, Number(req.params.id), String(text).trim(), file));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Message was not sent" });
  }
});

router.get("/chats/lead/:leadId/connect-link", async (req, res): Promise<void> => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const leadId = Number(req.params.leadId);
  res.json({ connectLink: await getConnectLink(leadId) });
});

export default router;
