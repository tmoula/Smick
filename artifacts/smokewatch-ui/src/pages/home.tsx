import { useState } from "react";
import { useLocation } from "wouter";
import {
  useStartSimulation,
  useListSessions,
  useStopSimulation,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListSessionsQueryKey } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Play, Square, Activity, StopCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [streamUrl, setStreamUrl] = useState("");
  const [cooldown, setCooldown] = useState(2);
  const [confidence, setConfidence] = useState([0.7]);

  const { data: sessions, isLoading, refetch } = useListSessions();
  const startSim = useStartSimulation();
  const stopSim = useStopSimulation();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streamUrl) return;

    startSim.mutate(
      { data: { streamUrl, cooldownMinutes: cooldown, confidenceThreshold: confidence[0] } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          setLocation(`/session/${res.sessionId}`);
        },
      }
    );
  };

  const handleStop = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    stopSim.mutate(
      { sessionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">New Simulation</h1>
        <p className="text-muted-foreground">Start a dry-run detection pipeline on a target stream URL.</p>
      </div>

      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <form onSubmit={handleStart} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">Stream URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://twitch.tv/target"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                required
                className="font-mono bg-background"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Cooldown (Minutes)</Label>
                  <span className="text-sm text-muted-foreground font-mono">{cooldown}m</span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={cooldown}
                  onChange={(e) => setCooldown(parseInt(e.target.value))}
                  className="font-mono bg-background"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Confidence Threshold</Label>
                  <span className="text-sm text-muted-foreground font-mono">{confidence[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={confidence}
                  onValueChange={setConfidence}
                  max={1}
                  step={0.05}
                  min={0.1}
                />
              </div>
            </div>

            <Button type="submit" disabled={startSim.isPending} className="w-full font-mono">
              {startSim.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start Simulation
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-mono font-semibold">Recent Sessions</h2>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground font-mono animate-pulse">Loading sessions...</div>
        ) : !sessions?.length ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-muted-foreground">
              No simulation sessions found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sessions.map((s) => (
              <Card 
                key={s.sessionId} 
                className={`cursor-pointer transition-all hover:border-primary/50 ${s.status === 'running' ? 'border-primary/30 bg-primary/5' : ''}`}
                onClick={() => setLocation(`/session/${s.sessionId}`)}
              >
                <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium truncate max-w-[200px] sm:max-w-xs">{s.streamUrl}</span>
                      {s.status === 'running' ? (
                        <Badge variant="default" className="bg-primary text-primary-foreground animate-pulse">
                          <Activity className="mr-1 h-3 w-3" /> Running
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <StopCircle className="mr-1 h-3 w-3" /> Stopped
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      ID: {s.sessionId.slice(0, 8)} • Started: {format(new Date(s.startedAt), "HH:mm:ss")}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-sm text-muted-foreground font-mono text-right">
                      <div>{s.detectionCount} detections</div>
                    </div>
                    {s.status === 'running' && (
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={(e) => handleStop(s.sessionId, e)}
                        disabled={stopSim.isPending}
                      >
                        <Square className="h-3 w-3 mr-1" /> Stop
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
