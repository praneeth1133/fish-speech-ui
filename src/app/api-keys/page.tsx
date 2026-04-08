"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Copy, Trash2, Key, Eye, EyeOff, Ban, Code2 } from "lucide-react";
import { toast } from "sonner";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type ApiKey,
} from "@/lib/api-keys-storage";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [backendStatus, setBackendStatus] = useState<"checking" | "connected" | "disconnected">("checking");

  const refresh = useCallback(() => {
    setKeys(listApiKeys());
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setBackendStatus(d.status === "connected" ? "connected" : "disconnected"))
      .catch(() => setBackendStatus("disconnected"));
  }, [refresh]);

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    try {
      const newKey = createApiKey(newKeyName);
      setNewlyCreatedKey(newKey.key);
      setNewKeyName("");
      refresh();
      toast.success("API key created");
    } catch {
      toast.error("Failed to create API key");
    }
  };

  const handleRevoke = (id: string) => {
    revokeApiKey(id);
    refresh();
    toast.success("API key revoked");
  };

  const handleDelete = (id: string) => {
    deleteApiKey(id);
    refresh();
    toast.success("API key deleted");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskKey = (key: string) => key.slice(0, 8) + "..." + key.slice(-4);

  const proxyHost = origin || "https://your-deployment.vercel.app";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Stored in your browser only — these are local to this device
          </p>
        </div>
        <Dialog
          open={isOpen}
          onOpenChange={(o) => {
            setIsOpen(o);
            if (!o) setNewlyCreatedKey(null);
          }}
        >
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Create Key
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
            </DialogHeader>
            {newlyCreatedKey ? (
              <div className="space-y-4 pt-4">
                <div className="rounded-lg border bg-green-500/10 border-green-500/20 p-4 space-y-2">
                  <p className="text-sm font-medium text-green-400">
                    API Key Created Successfully
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Copy this key now. You won&apos;t be able to see the full key again.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 text-xs bg-background rounded px-3 py-2 font-mono break-all">
                      {newlyCreatedKey}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    setNewlyCreatedKey(null);
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Key Name</Label>
                  <Input
                    placeholder="e.g., Production App, Mobile Client"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName.trim()}
                  className="w-full"
                >
                  Generate API Key
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="max-w-4xl">
          {/* Keys List */}
          {keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No API keys yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create an API key to access Fish Speech programmatically
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="rounded-lg border bg-card p-4 flex items-center gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{apiKey.name}</p>
                      {apiKey.active ? (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground font-mono">
                        {revealedKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleReveal(apiKey.id)}
                      >
                        {revealedKeys.has(apiKey.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(apiKey.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(apiKey.key)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {apiKey.active ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-orange-500"
                        onClick={() => handleRevoke(apiKey.id)}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(apiKey.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-8" />

          {/* API Documentation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Use the proxy URL to generate speech from anywhere on the internet.
                  Requests are forwarded to your local Fish Speech backend.
                </p>
                <div className="rounded-lg bg-muted p-4 font-mono text-xs space-y-4 overflow-x-auto">
                  <div>
                    <p className="text-muted-foreground mb-1"># cURL example</p>
                    <pre>{`curl -X POST ${proxyHost}/api/tts \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Hello from Fish Speech!", "format": "wav"}' \\
  --output speech.wav`}</pre>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1"># Python example</p>
                    <pre>{`import requests

response = requests.post(
    "${proxyHost}/api/tts",
    json={"text": "Hello from Fish Speech!", "format": "wav"},
)

with open("speech.wav", "wb") as f:
    f.write(response.content)`}</pre>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1"># JavaScript example</p>
                    <pre>{`const response = await fetch("${proxyHost}/api/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hello from Fish Speech!",
    format: "wav",
  }),
});
const audioBlob = await response.blob();`}</pre>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium">Deployment Info</p>
                <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Public URL:</span>
                  <code className="font-mono text-xs break-all">{origin || "(loading)"}</code>
                  <span className="text-muted-foreground">Backend:</span>
                  <span className="text-xs">
                    {backendStatus === "checking" && (
                      <Badge variant="outline" className="text-[10px]">Checking…</Badge>
                    )}
                    {backendStatus === "connected" && (
                      <Badge variant="secondary" className="text-[10px]">Connected</Badge>
                    )}
                    {backendStatus === "disconnected" && (
                      <Badge variant="destructive" className="text-[10px]">Disconnected</Badge>
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
