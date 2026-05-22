import { Router, type IRouter } from "express";
import {
  StartSimulationBody,
  StopSimulationParams,
  GetSessionLogParams,
  ListSessionsResponse,
  GetAllLogsResponse,
  GetSessionLogResponse,
  StopSimulationResponse,
} from "@workspace/api-zod";
import {
  startSession,
  stopSession,
  listSessions,
  getSession,
  getSessionEvents,
  getAllEvents,
  subscribe,
} from "../lib/simulator";

const router: IRouter = Router();

router.post("/simulate/start", async (req, res): Promise<void> => {
  const parsed = StartSimulationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { streamUrl, cooldownMinutes = 5, confidenceThreshold = 0.6 } = parsed.data;
  const session = startSession(streamUrl, cooldownMinutes, confidenceThreshold);
  res.status(201).json(session);
});

router.get("/simulate/sessions", async (_req, res): Promise<void> => {
  const sessions = listSessions();
  res.json(ListSessionsResponse.parse(sessions));
});

router.get("/simulate/log", async (_req, res): Promise<void> => {
  const events = getAllEvents();
  res.json(GetAllLogsResponse.parse(events));
});

router.delete("/simulate/:sessionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId;
  const params = StopSimulationParams.safeParse({ sessionId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const stopped = stopSession(params.data.sessionId);
  if (!stopped) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(StopSimulationResponse.parse({ status: "stopped" }));
});

router.get("/simulate/:sessionId/log", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId;
  const params = GetSessionLogParams.safeParse({ sessionId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = getSession(params.data.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const events = getSessionEvents(params.data.sessionId);
  res.json(GetSessionLogResponse.parse(events));
});

router.get("/simulate/:sessionId/events", (req, res): void => {
  const rawId = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId;

  const session = getSession(rawId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (eventName: string, data: unknown) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", { sessionId: rawId });

  const unsubscribe = subscribe(rawId, (event) => {
    if (event.type === "frame") {
      send("frame", event.data);
    } else if (event.type === "detection") {
      send("detection", event.data);
    } else if (event.type === "stopped") {
      send("stopped", {});
      res.end();
    }
  });

  req.on("close", () => {
    unsubscribe();
  });
});

export default router;
