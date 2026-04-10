/**
 * Preset scripts for voice recording. Each is ~15-20 seconds when read at a
 * natural pace — long enough for Fish Speech to capture voice characteristics,
 * short enough that users don't get bored.
 *
 * The text is submitted as `reference_text` alongside the recorded audio so
 * Fish Speech can align the two for voice cloning.
 */
export interface RecordingScript {
  id: string;
  label: string;
  description: string;
  text: string;
  estimatedSeconds: number;
}

export const RECORDING_SCRIPTS: RecordingScript[] = [
  {
    id: "friendly",
    label: "Friendly",
    description: "Warm, conversational",
    text: "Hello! My name is Alex, and I'm really glad you're here. I love reading books, listening to music, and spending time with family on weekends. It's genuinely nice to meet you, and I hope you have a wonderful day ahead.",
    estimatedSeconds: 16,
  },
  {
    id: "expressive",
    label: "Expressive",
    description: "Dynamic, emotional range",
    text: "Wait — you won't believe what happened today! I was walking downtown when suddenly I saw the most incredible thing. At first I couldn't believe my eyes, but then I realized it was real. Honestly, it completely made my whole day better.",
    estimatedSeconds: 17,
  },
  {
    id: "calm",
    label: "Calm",
    description: "Soft, measured delivery",
    text: "The sun slowly set behind the mountains, painting the sky in shades of orange and purple. A gentle breeze rustled through the trees as the day came peacefully to an end. Far in the distance, a single bird called out one last time before silence settled in.",
    estimatedSeconds: 18,
  },
];

export const DEFAULT_SCRIPT_ID = "friendly";
