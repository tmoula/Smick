import { randomUUID } from "crypto";
import { logger } from "./logger";

export interface SimulationSession {
  sessionId: string;
  streamUrl: string;
  status: "running" | "stopped";
  startedAt: string;
  stoppedAt: string | null;
  detectionCount: number;
  cooldownMinutes: number;
  confidenceThreshold: number;
  lastDetectedAt: string | null;
}

export interface DetectionEvent {
  eventId: string;
  sessionId: string;
  streamUrl: string;
  timestamp: string;
  confidence: number;
  messageSent: string | null;
  blockedByCooldown: boolean;
  frameNumber: number;
}

export interface FrameScanEvent {
  type: "frame";
  sessionId: string;
  frameNumber: number;
  timestamp: string;
  detected: boolean;
  confidence: number;
}

export type SimEvent =
  | { type: "frame"; data: FrameScanEvent }
  | { type: "detection"; data: DetectionEvent }
  | { type: "stopped" };

type Listener = (event: SimEvent) => void;

const DEFAULT_MESSAGES = [
  "I smoked for 15 years — quitting changed my life. If you're curious how, this book helped me more than anything: allencart.com",
  "Fun fact: my first week without cigarettes I slept better than I had in a decade. Story + the book that helped: allencart.com",
  "Quitting smoking was the hardest and best thing I ever did. One book made it click for me: allencart.com",
  "Not judging — just sharing. I was a pack-a-day smoker. This changed everything for me: allencart.com",
  "Someone once sent me a link that quietly changed my relationship with cigarettes. Paying it forward: allencart.com",
];

let messagePool: string[] = [...DEFAULT_MESSAGES];
let chatLink = "allencart.com";

export function getMessagePool() {
  return { messages: messagePool, link: chatLink };
}

export function setMessagePool(messages: string[], link: string) {
  messagePool = messages;
  chatLink = link;
}

function pickMessage(): string {
  return messagePool[Math.floor(Math.random() * messagePool.length)] ?? "";
}

const sessions = new Map<string, SimulationSession>();
const allEvents: DetectionEvent[] = [];
const listeners = new Map<string, Set<Listener>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit(sessionId: string, event: SimEvent) {
  const subs = listeners.get(sessionId);
  if (subs) {
    subs.forEach((fn) => fn(event));
  }
}

export function subscribe(sessionId: string, fn: Listener): () => void {
  if (!listeners.has(sessionId)) {
    listeners.set(sessionId, new Set());
  }
  listeners.get(sessionId)!.add(fn);
  return () => {
    listeners.get(sessionId)?.delete(fn);
  };
}

export function startSession(
  streamUrl: string,
  cooldownMinutes: number,
  confidenceThreshold: number
): SimulationSession {
  const sessionId = randomUUID();
  const session: SimulationSession = {
    sessionId,
    streamUrl,
    status: "running",
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    detectionCount: 0,
    cooldownMinutes,
    confidenceThreshold,
    lastDetectedAt: null,
  };
  sessions.set(sessionId, session);
  logger.info({ sessionId, streamUrl }, "Simulation session started");
  scheduleNextFrame(sessionId, 1);
  return session;
}

function isOnCooldown(session: SimulationSession): boolean {
  if (!session.lastDetectedAt) return false;
  const lastMs = new Date(session.lastDetectedAt).getTime();
  const cooldownMs = session.cooldownMinutes * 60 * 1000;
  return Date.now() - lastMs < cooldownMs;
}

function scheduleNextFrame(sessionId: string, frameNumber: number) {
  const delay = 2000 + Math.random() * 500;

  const t = setTimeout(() => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== "running") return;

    const confidence = parseFloat((Math.random()).toFixed(2));
    const detected = confidence >= session.confidenceThreshold && Math.random() < 0.08;

    const scanEvent: FrameScanEvent = {
      type: "frame",
      sessionId,
      frameNumber,
      timestamp: new Date().toISOString(),
      detected,
      confidence: detected ? confidence : parseFloat((Math.random() * (session.confidenceThreshold - 0.05)).toFixed(2)),
    };

    emit(sessionId, { type: "frame", data: scanEvent });

    if (detected) {
      const onCooldown = isOnCooldown(session);
      const message = onCooldown ? null : pickMessage();

      const detectionEvent: DetectionEvent = {
        eventId: randomUUID(),
        sessionId,
        streamUrl: session.streamUrl,
        timestamp: new Date().toISOString(),
        confidence: scanEvent.confidence,
        messageSent: message,
        blockedByCooldown: onCooldown,
        frameNumber,
      };

      if (!onCooldown) {
        session.detectionCount++;
        session.lastDetectedAt = detectionEvent.timestamp;
      }

      allEvents.push(detectionEvent);
      emit(sessionId, { type: "detection", data: detectionEvent });

      logger.info(
        { sessionId, confidence: detectionEvent.confidence, blocked: onCooldown },
        "Cigarette detection simulated"
      );
    }

    scheduleNextFrame(sessionId, frameNumber + 1);
  }, delay);

  timers.set(sessionId, t);
}

export function stopSession(sessionId: string): SimulationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  clearTimeout(timers.get(sessionId));
  timers.delete(sessionId);

  session.status = "stopped";
  session.stoppedAt = new Date().toISOString();

  emit(sessionId, { type: "stopped" });
  logger.info({ sessionId }, "Simulation session stopped");
  return session;
}

export function listSessions(): SimulationSession[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function getSession(sessionId: string): SimulationSession | undefined {
  return sessions.get(sessionId);
}

export function getSessionEvents(sessionId: string): DetectionEvent[] {
  return allEvents.filter((e) => e.sessionId === sessionId);
}

export function getAllEvents(): DetectionEvent[] {
  return [...allEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
