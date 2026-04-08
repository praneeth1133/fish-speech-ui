"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { Clock, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { listHistory, deleteHistoryItem, type HistoryItem } from "@/lib/idb";

interface HistoryRow extends HistoryItem {
  url: string;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listHistory();
      // Build object URLs for each row's blob. They are revoked on cleanup.
      const enriched: HistoryRow[] = items.map((it) => ({
        ...it,
        url: URL.createObjectURL(it.blob),
      }));
      setRows((prev) => {
        // Revoke any URLs from the previous render before replacing
        for (const r of prev) URL.revokeObjectURL(r.url);
        return enriched;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    return () => {
      // Final cleanup on unmount
      setRows((prev) => {
        for (const r of prev) URL.revokeObjectURL(r.url);
        return [];
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteHistoryItem(id);
      toast.success("Generation deleted");
      await fetchHistory();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleDownload = (row: HistoryRow) => {
    const a = document.createElement("a");
    a.href = row.url;
    a.download = `fish-speech-${row.id.slice(0, 8)}.${row.format}`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">Generation History</h2>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${rows.length} generation${rows.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!loading && rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No generations yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generated audio will appear here
            </p>
          </div>
        ) : (
          <div className="max-w-4xl space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{row.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-xs">
                        {row.voice_name}
                      </Badge>
                      <Badge variant="outline" className="text-xs uppercase">
                        {row.format}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Download"
                      onClick={() => handleDownload(row)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="Delete"
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <AudioPlayer src={row.url} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
