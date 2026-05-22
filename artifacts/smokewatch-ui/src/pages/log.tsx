import { useGetAllLogs } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { RefreshCw, ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Log() {
  const { data: logs, isLoading, refetch } = useGetAllLogs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Detection Log</h1>
          <p className="text-muted-foreground">Global history of all simulated detection events.</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card className="overflow-hidden border-secondary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left font-mono">
            <thead className="text-xs uppercase bg-secondary/50 border-b border-border">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Stream</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 min-w-[300px]">Simulated Output</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground animate-pulse">
                    Loading logs...
                  </td>
                </tr>
              ) : !logs?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground border-dashed border-2 m-4 rounded">
                    <ListFilter className="mx-auto h-8 w-8 mb-2 opacity-20" />
                    No detection logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.eventId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 max-w-[150px] truncate" title={log.streamUrl}>
                      {log.streamUrl.replace('https://', '')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden max-w-[50px]">
                          <div 
                            className={`h-full ${log.blockedByCooldown ? 'bg-muted-foreground' : 'bg-primary'}`} 
                            style={{ width: `${log.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs">{(log.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.blockedByCooldown ? (
                        <Badge variant="secondary" className="text-[10px]">COOLDOWN</Badge>
                      ) : (
                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-[10px] border-primary/20">SENT</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {log.blockedByCooldown ? (
                        <span className="italic opacity-50">Blocked</span>
                      ) : (
                        <span className="text-foreground">{log.messageSent}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
