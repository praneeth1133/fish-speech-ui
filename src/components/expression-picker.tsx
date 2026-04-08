"use client";

import { useState } from "react";
import {
  EXPRESSION_CATEGORIES,
  type ExpressionTag,
} from "@/lib/expression-tags";
import { Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ExpressionPickerProps {
  onInsert: (tag: string) => void;
}

/**
 * ElevenLabs v3-style tag picker. Renders a row of category chips below the
 * textarea. Clicking a category reveals the tags in that group; clicking a
 * tag inserts it at the cursor position via the onInsert callback.
 */
export function ExpressionPicker({ onInsert }: ExpressionPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const active = EXPRESSION_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
        <Sparkles className="h-3 w-3" />
        Expression Tags
      </div>

      {/* Category row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {EXPRESSION_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(isActive ? null : cat.id)}
              className={`px-2.5 py-1 rounded-full border text-[11px] flex items-center gap-1.5 transition-all duration-150 ${
                isActive
                  ? "bg-accent border-ring text-foreground"
                  : "bg-muted/40 border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-150 ${
                  isActive ? "rotate-180" : ""
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Active category's tag grid */}
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex flex-wrap gap-1.5 pt-1"
          >
            {active.tags.map((t: ExpressionTag) => (
              <button
                key={t.tag}
                type="button"
                onClick={() => onInsert(t.tag)}
                title={`Insert [${t.tag}]`}
                className="px-2 py-1 rounded-md border border-border bg-card/60
                           text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground
                           hover:border-ring transition-all duration-150
                           flex items-center gap-1.5"
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
