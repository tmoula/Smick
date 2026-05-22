import { Router, type IRouter } from "express";
import { UpdateMessagesBody, GetMessagesResponse, UpdateMessagesResponse } from "@workspace/api-zod";
import { getMessagePool, setMessagePool } from "../lib/simulator";

const router: IRouter = Router();

router.get("/messages", async (_req, res): Promise<void> => {
  const pool = getMessagePool();
  res.json(GetMessagesResponse.parse(pool));
});

router.put("/messages", async (req, res): Promise<void> => {
  const parsed = UpdateMessagesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  setMessagePool(parsed.data.messages, parsed.data.link);
  res.json(UpdateMessagesResponse.parse(getMessagePool()));
});

export default router;
