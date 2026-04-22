"use client";

import { motion } from "framer-motion";

/**
 * A unique gradient avatar for each voice. Background colors are derived
 * deterministically from the voice's id so the same voice always looks the
 * same — but every voice gets its own distinct palette.
 */
const PALETTES: Array<[string, string, string]> = [
  // [from, via, to] tailwind-like hex triples
  ["#ff7eb3", "#ff758c", "#ff7eb3"],
  ["#7f7fd5", "#86a8e7", "#91eae4"],
  ["#f6d365", "#fda085", "#f6d365"],
  ["#43cea2", "#185a9d", "#43cea2"],
  ["#ff9a9e", "#fad0c4", "#fbc2eb"],
  ["#a18cd1", "#fbc2eb", "#a18cd1"],
  ["#ffecd2", "#fcb69f", "#ffecd2"],
  ["#84fab0", "#8fd3f4", "#84fab0"],
  ["#d4fc79", "#96e6a1", "#d4fc79"],
  ["#fa709a", "#fee140", "#fa709a"],
  ["#30cfd0", "#330867", "#30cfd0"],
  ["#a8edea", "#fed6e3", "#a8edea"],
  ["#fddb92", "#d1fdff", "#fddb92"],
  ["#667eea", "#764ba2", "#667eea"],
  ["#f093fb", "#f5576c", "#f093fb"],
  ["#ffc3a0", "#ffafbd", "#ffc3a0"],
  ["#c471f5", "#fa71cd", "#c471f5"],
  ["#12c2e9", "#c471ed", "#f64f59"],
  ["#accbee", "#e7f0fd", "#accbee"],
  ["#feada6", "#f5efef", "#feada6"],
  ["#5ee7df", "#b490ca", "#5ee7df"],
  ["#eccc68", "#ff7f50", "#eccc68"],
  ["#48c6ef", "#6f86d6", "#48c6ef"],
  ["#fccb90", "#d57eeb", "#fccb90"],
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function paletteFor(id: string): [string, string, string] {
  return PALETTES[hashCode(id) % PALETTES.length];
}

interface VoiceAvatarProps {
  id: string;
  initials: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function VoiceAvatar({ id, initials, size = "md", animated = true }: VoiceAvatarProps) {
  const [c1, c2, c3] = paletteFor(id);
  const sizeClasses = {
    sm: "w-8 h-8 text-[9px]",
    md: "w-10 h-10 text-[11px]",
    lg: "w-12 h-12 text-[13px]",
  };

  const gradient = `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;

  if (animated) {
    return (
      <motion.div
        whileHover={{ scale: 1.08, rotate: 3 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className={`flex-shrink-0 ${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white/95 shadow-sm relative overflow-hidden`}
        style={{ background: gradient }}
      >
        {/* Shimmer pass on hover */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
          }}
          initial={{ x: "-120%" }}
          whileHover={{ x: "120%" }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
        <span className="relative drop-shadow-sm">{initials.toUpperCase()}</span>
      </motion.div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 ${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white/95 shadow-sm`}
      style={{ background: gradient }}
    >
      {initials.toUpperCase()}
    </div>
  );
}
