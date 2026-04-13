"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Wand2, Users } from "lucide-react";
import { useTTSSettingsStore } from "@/lib/tts-settings-store";
import { ExpressionPicker } from "@/components/expression-picker";
import { BatchPipeline } from "@/components/batch-pipeline";
import { QueuePanel } from "@/components/queue-panel";
import { insertTagAtCursor } from "@/lib/expression-tags";

const PROMPT_SUGGESTIONS = [
  "Hello! Welcome to Fish Speech, the most natural text-to-speech system.",
  "[excited] I can't believe we won! This is absolutely incredible!",
  "Breaking news: Scientists discover high energy particles from deep space.",
  "[whispers] Let me tell you a secret that nobody else knows...",
  "In a world full of noise, sometimes a gentle whisper speaks the loudest.",
  "The quick brown fox jumps over the lazy dog near the riverbank.",
];

export function TextEditor() {
  const text = useTTSSettingsStore((s) => s.text);
  const setText = useTTSSettingsStore((s) => s.setText);
  const isGenerating = useTTSSettingsStore((s) => s.isGenerating);
  const isAnnotating = useTTSSettingsStore((s) => s.isAnnotating);
  const isIdentifying = useTTSSettingsStore((s) => s.isIdentifying);
  const generate = useTTSSettingsStore((s) => s.generate);
  const generateExpressions = useTTSSettingsStore((s) => s.generateExpressions);
  const identifyCharacters = useTTSSettingsStore((s) => s.identifyCharacters);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTag = (tag: string) => {
    const ta = textareaRef.current;
    const current = useTTSSettingsStore.getState().text;
    const start = ta?.selectionStart ?? current.length;
    const end = ta?.selectionEnd ?? current.length;
    const { value, cursor } = insertTagAtCursor(current, start, end, tag);
    setText(value);
    // Restore focus + cursor after React re-renders the value
    requestAnimationFrame(() => {
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="flex flex-col h-full w-full lg:border-r border-border">
      {/* Header - fixed height */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2 flex-shrink-0">
        <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
          Text to Speech
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Fish Speech S2 Pro
        </p>
      </div>

      {/* Scrollable content area - takes remaining space */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-col">
        {/* Text area with borders */}
        <div className="relative rounded-lg border-2 border-border bg-card p-4">
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent text-sm sm:text-[15px] leading-[1.7] sm:leading-[1.8]
                       text-foreground placeholder:text-muted-foreground/50 focus:outline-none
                       selection:bg-accent font-[inherit]"
            style={{ minHeight: "200px", height: "auto" }}
            placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          {text.length > 0 && (
            <span className="absolute bottom-2 right-3 text-[10px] sm:text-[11px] text-muted-foreground/50 font-mono tabular-nums pointer-events-none">
              {text.length} characters
            </span>
          )}
        </div>

        {/* Expression tags picker */}
        <ExpressionPicker onInsert={handleInsertTag} />

        {/* Action buttons */}
        <div className="mt-6 mb-4 space-y-2">
          {/* AI-powered helpers — two outline buttons */}
          <div className="flex gap-2">
            <Button
              onClick={generateExpressions}
              disabled={!text.trim() || isAnnotating || isGenerating || isIdentifying}
              variant="outline"
              size="default"
              className="flex-1 h-10 text-sm font-semibold rounded-lg transition-all duration-200"
            >
              {isAnnotating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4 mr-2" />
              )}
              {isAnnotating ? "Adding Tags..." : "Generate Expressions"}
            </Button>
            <Button
              onClick={identifyCharacters}
              disabled={!text.trim() || isIdentifying || isGenerating || isAnnotating}
              variant="outline"
              size="default"
              className="flex-1 h-10 text-sm font-semibold rounded-lg transition-all duration-200"
            >
              {isIdentifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              {isIdentifying ? "Parsing..." : "Identify Characters"}
            </Button>
          </div>

          {/* Primary action */}
          <Button
            onClick={generate}
            disabled={!text.trim() || isGenerating || isAnnotating || isIdentifying}
            size="lg"
            className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground
                       hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground
                       rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 mr-2" />
            )}
            {isGenerating ? "Generating..." : "Generate Speech"}
          </Button>
        </div>

        {/* Multi-voice pipeline — only renders when a batch is active or recently finished */}
        <BatchPipeline />

        {/* Queue — always visible below the action area */}
        <QueuePanel />

        {/* Prompt suggestions - only when no text */}
        {!text && (
          <div>
            <p className="text-[10px] sm:text-[11px] text-muted-foreground/50 mb-3 uppercase tracking-wider font-medium">
              Get started with
            </p>
            <div className="flex flex-wrap gap-2">
              {PROMPT_SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(s)}
                  className="px-3 py-1.5 rounded-full bg-muted/50 border border-border
                             text-[11px] sm:text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground/80
                             hover:border-ring transition-all duration-200 max-w-[200px] sm:max-w-[280px] truncate"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
