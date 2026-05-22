import { useEffect, useState } from "react";
import { useGetMessages, useUpdateMessages } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMessagesQueryKey } from "@workspace/api-client-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageSquare, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Messages() {
  const { data: messagePool, isLoading } = useGetMessages();
  const updateMsgs = useUpdateMessages();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [messages, setMessages] = useState<string[]>(Array(5).fill(""));
  const [link, setLink] = useState("");

  useEffect(() => {
    if (messagePool) {
      const paddedMsgs = [...messagePool.messages];
      while (paddedMsgs.length < 5) paddedMsgs.push("");
      setMessages(paddedMsgs.slice(0, 5));
      setLink(messagePool.link);
    }
  }, [messagePool]);

  const handleSave = () => {
    const validMessages = messages.filter(m => m.trim().length > 0);
    if (validMessages.length === 0) {
      toast({
        title: "Error",
        description: "Must have at least one message.",
        variant: "destructive"
      });
      return;
    }
    
    updateMsgs.mutate({ data: { messages: validMessages, link } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey() });
        toast({
          title: "Saved",
          description: "Message pool updated successfully.",
        });
      }
    });
  };

  const handleMessageChange = (index: number, val: string) => {
    const newMsgs = [...messages];
    newMsgs[index] = val;
    setMessages(newMsgs);
  };

  if (isLoading) {
    return <div className="p-8 text-center font-mono text-muted-foreground animate-pulse">Loading messages...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight mb-2">Message Editor</h1>
        <p className="text-muted-foreground">Configure the automated chat messages and resources sent upon detection.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card className="border-secondary">
            <CardHeader>
              <CardTitle className="font-mono flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> 
                Message Templates
              </CardTitle>
              <CardDescription>
                The simulator randomly selects one of these templates per detection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">Template {idx + 1}</Label>
                  <Input 
                    value={msg}
                    onChange={(e) => handleMessageChange(idx, e.target.value)}
                    placeholder="e.g. Quitting is tough, but you can do it!"
                    className="font-mono"
                  />
                </div>
              ))}

              <div className="pt-4 border-t border-border mt-6">
                <Label className="text-xs text-muted-foreground font-mono mb-2 block">Appended Link</Label>
                <Input 
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://smokefree.gov"
                  className="font-mono text-primary"
                />
              </div>

              <Button 
                onClick={handleSave} 
                disabled={updateMsgs.isPending} 
                className="w-full mt-6 font-mono"
              >
                {updateMsgs.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <h3 className="font-mono font-semibold text-muted-foreground uppercase text-sm tracking-wider">Live Previews</h3>
          <div className="space-y-4">
            {messages.filter(m => m.trim().length > 0).map((msg, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Terminal className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">SmokeWatch_Bot</span>
                    <Badge variant="outline" className="text-[9px] px-1 h-4">BOT</Badge>
                  </div>
                  <div className="text-sm font-sans">
                    {msg} {link && <span className="text-blue-400 hover:underline cursor-pointer">{link}</span>}
                  </div>
                </div>
              </div>
            ))}
            
            {messages.filter(m => m.trim().length > 0).length === 0 && (
              <div className="p-8 text-center border-dashed border-2 border-border rounded-lg text-muted-foreground font-mono text-sm">
                Add templates to see preview
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Terminal } from "lucide-react";
