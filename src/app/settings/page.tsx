"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Server, Cpu, Wifi } from "lucide-react";

interface HealthInfo {
  status: string;
  fish_speech_url: string;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Server configuration and system information
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          {/* Server Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5" />
                Server Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fish Speech Backend</p>
                  <div className="flex items-center gap-2">
                    {health?.status === "connected" ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Disconnected</Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Backend URL</p>
                  <code className="text-sm font-mono">
                    {health?.fish_speech_url || "N/A"}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-5 w-5" />
                Network Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Access Fish Speech from anywhere on the internet via this deployment:
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Web UI</p>
                    <p className="text-xs text-muted-foreground">
                      Full interface for text-to-speech
                    </p>
                  </div>
                  <code className="text-sm font-mono bg-muted px-3 py-1 rounded break-all">
                    {origin || "(loading)"}
                  </code>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">API Endpoint</p>
                    <p className="text-xs text-muted-foreground">
                      Proxied to your local backend
                    </p>
                  </div>
                  <code className="text-sm font-mono bg-muted px-3 py-1 rounded break-all">
                    {origin ? `${origin}/api/tts` : "(loading)"}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-5 w-5" />
                Model Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <span className="text-muted-foreground">Model</span>
                <span>Fish Speech S2 Pro</span>
                <span className="text-muted-foreground">Precision</span>
                <span>FP16 (Half Precision)</span>
                <span className="text-muted-foreground">Parameters</span>
                <span>4B (Slow AR) + 400M (Fast AR)</span>
                <span className="text-muted-foreground">Architecture</span>
                <span>Dual Autoregressive</span>
                <span className="text-muted-foreground">Languages</span>
                <span>80+ languages</span>
                <span className="text-muted-foreground">VRAM Usage</span>
                <span>~10 GB (FP16)</span>
              </div>
            </CardContent>
          </Card>

          {/* Emotion Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5" />
                Supported Emotion Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Use these tags inline in your text for expressive speech:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "[laughs]",
                  "[whispers]",
                  "[excited]",
                  "[sad]",
                  "[angry]",
                  "[surprised]",
                  "[sarcastic]",
                  "[sighs]",
                  "[coughs]",
                  "[gasps]",
                  "[cheerful]",
                  "[nervous]",
                  "[serious]",
                  "[calm]",
                ].map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-mono">
                    {tag}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Fish Speech S2 supports 15,000+ emotion and style tags
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
