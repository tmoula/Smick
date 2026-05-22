import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetSessionLog,
  useStopSimulation,
  useListSessions,
  DetectionEvent
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionLogQueryKey, getListSessionsQueryKey } from "@workspace/api-client-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Square, ArrowLeft, AlertTriangle, MessageSquare, CheckCircle } from "lucide-react";
import { format } from "date-fns";

type FrameEvent = {
  sessionId: string;
  frameNumber: number;
  timestamp: string;
  detected: boolean;
  confidence: number;
};

export function SessionDetail({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [frames, setFrames] = useState<FrameEvent[]>([]);
  const [liveDetections, setLiveDetections] = useState<DetectionEvent[]>([]);
  const [isLive, setIsLive] = useState(false);

  const { data: sessions } = useListSessions();
  const session = sessions?.find(s => s.sessionId === sessionId);
  const stopSim = useStopSimulation();

  const { data: initialLog } = useGetSessionLog(sessionId);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (initialLog && liveDetections.length === 0) {
      setLiveDetections(initialLog);
    }
  }, [initialLog]);

  useEffect(() => {
    // Determine domain for SSE
    const baseUrl = import.meta.env.VITE_API_URL || "";
    const sseUrl = `${baseUrl}/api/simulate/${sessionId}/events`;
    
    console.log("Connecting to SSE:", sseUrl);
    const sse = new EventSource(sseUrl);
    eventSourceRef.current = sse;
    setIsLive(true);

    sse.addEventListener("frame", (e) => {
      try {
        const frameData = JSON.parse(e.data) as FrameEvent;
        setFrames(prev => [frameData, ...prev].slice(0, 10)); // keep last 10 frames
      } catch (err) {
        console.error("Failed to parse frame", err);
      }
    });

    sse.addEventListener("detection", (e) => {
      try {
        const detectionData = JSON.parse(e.data) as DetectionEvent;
        setLiveDetections(prev => [detectionData, ...prev]);
        queryClient.invalidateQueries({ queryKey: getGetSessionLogQueryKey(sessionId) });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
      } catch (err) {
        console.error("Failed to parse detection", err);
      }
    });

    sse.addEventListener("stopped", () => {
      setIsLive(false);
      sse.close();
      queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
    });

    sse.onerror = () => {
      setIsLive(false);
      sse.close();
    };

    return () => {
      sse.close();
    };
  }, [sessionId, queryClient]);

  const handleStop = () => {
    stopSim.mutate({ sessionId }, {
      onSuccess: () => {
        setIsLive(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
      }
    });
  };

  const totalFrames = frames.length > 0 ? frames[0].frameNumber : 0;
  const sentMessagesCount = liveDetections.filter(d => !d.blockedByCooldown).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="link" className="p-0 h-auto text-muted-foreground mb-2" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold tracking-tight">Session View</h1>
            {isLive ? (
              <Badge className="bg-primary text-primary-foreground animate-pulse">LIVE</Badge>
            ) : (
              <Badge variant="secondary">STOPPED</Badge>
            )}
          </div>
          {session && (
            <p className="font-mono text-sm text-muted-foreground">{session.streamUrl}</p>
          )}
        </div>

        {isLive && (
          <Button variant="destructive" onClick={handleStop} disabled={stopSim.isPending}>
            <Square className="mr-2 h-4 w-4" /> Stop Simulation
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-mono uppercase">Frames Scanned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{totalFrames}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-mono uppercase">Detections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{liveDetections.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-mono uppercase">Messages Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-primary">{sentMessagesCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-mono font-semibold flex items-center">
            <Activity className="mr-2 h-4 w-4 text-primary" /> Live Feed
          </h3>
          <Card className="bg-black/50 border-secondary overflow-hidden">
            <div className="p-4 space-y-3 min-h-[400px]">
              {frames.length === 0 ? (
                <div className="text-muted-foreground text-sm font-mono text-center mt-10">Waiting for frames...</div>
              ) : (
                frames.map((f, i) => (
                  <div key={`${f.frameNumber}-${i}`} className={`text-xs font-mono p-2 rounded border ${f.detected ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground'}`}>
                    <div className="flex justify-between mb-1">
                      <span>Frame #{f.frameNumber}</span>
                      <span>{format(new Date(f.timestamp), "HH:mm:ss")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8">Conf:</span>
                      <Progress value={f.confidence * 100} className={`h-1.5 flex-1 ${f.detected ? 'bg-primary/20' : 'bg-secondary'}`} indicatorColor={f.detected ? 'bg-primary' : 'bg-muted-foreground'} />
                      <span className="w-8 text-right">{(f.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-mono font-semibold flex items-center">
            <AlertTriangle className="mr-2 h-4 w-4 text-yellow-500" /> Detection Events
          </h3>
          <div className="space-y-4">
            {liveDetections.length === 0 ? (
              <Card className="border-dashed bg-transparent">
                <CardContent className="py-12 text-center text-muted-foreground font-mono">
                  No detections yet.
                </CardContent>
              </Card>
            ) : (
              liveDetections.map((d) => (
                <Card key={d.eventId} className={`overflow-hidden ${d.blockedByCooldown ? 'border-muted bg-secondary/30' : 'border-primary/30 bg-primary/5'}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {d.blockedByCooldown ? (
                          <Badge variant="secondary" className="font-mono">COOLDOWN</Badge>
                        ) : (
                          <Badge className="bg-primary text-primary-foreground font-mono">SENT</Badge>
                        )}
                        <span className="text-sm font-mono text-muted-foreground">
                          {format(new Date(d.timestamp), "HH:mm:ss")} • Frame #{d.frameNumber}
                        </span>
                      </div>
                      <div className="text-sm font-mono flex items-center gap-2">
                        Conf: <span className={d.blockedByCooldown ? 'text-muted-foreground' : 'text-primary'}>{(d.confidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <div className={`p-3 rounded-md border ${d.blockedByCooldown ? 'border-border/50 bg-background/50 text-muted-foreground' : 'border-primary/20 bg-background text-foreground'}`}>
                      <div className="flex items-start gap-3">
                        <MessageSquare className={`h-5 w-5 mt-0.5 ${d.blockedByCooldown ? 'text-muted-foreground' : 'text-primary'}`} />
                        <div>
                          {d.blockedByCooldown ? (
                            <span className="italic">Message blocked by cooldown period.</span>
                          ) : (
                            <span className="font-medium">{d.messageSent}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
