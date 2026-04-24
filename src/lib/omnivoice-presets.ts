/**
 * OmniVoice-native voice presets — each one is a curated combination of the
 * attribute dropdowns that the `_design_fn` Gradio endpoint exposes
 * (Gender / Age / Pitch / Style / Accent / Dialect).
 *
 * The model provides no audio reference library of its own, so these presets
 * are named personalities built from what the model can actually vary.
 */

export interface OmniVoicePreset {
  id: string;
  name: string;
  tagline: string;
  initials: string;
  gender?: "Male / 男" | "Female / 女" | "Auto";
  age?:
    | "Child / 儿童"
    | "Teenager / 少年"
    | "Young Adult / 青年"
    | "Middle-aged / 中年"
    | "Elderly / 老年"
    | "Auto";
  pitch?:
    | "Very Low Pitch / 极低音调"
    | "Low Pitch / 低音调"
    | "Moderate Pitch / 中音调"
    | "High Pitch / 高音调"
    | "Very High Pitch / 极高音调"
    | "Auto";
  style?: "Whisper / 耳语" | "Auto";
  accent?:
    | "American Accent / 美式口音"
    | "British Accent / 英国口音"
    | "Australian Accent / 澳大利亚口音"
    | "Canadian Accent / 加拿大口音"
    | "Indian Accent / 印度口音"
    | "Chinese Accent / 中国口音"
    | "Japanese Accent / 日本口音"
    | "Korean Accent / 韩国口音"
    | "Russian Accent / 俄罗斯口音"
    | "Portuguese Accent / 葡萄牙口音"
    | "Auto";
  dialect?: string; // Chinese dialect (rarely used for English)
  /**
   * When set, this preset represents a Fish Speech reference voice bridged
   * into OmniVoice. The API route will fetch the reference WAV from the
   * local backend and feed it into OmniVoice's _clone_fn endpoint.
   * When unset, the preset uses OmniVoice's attribute-driven _design_fn
   * instead.
   */
  fishSpeechVoiceId?: string;
  /** Where this preset came from — drives UI badges and sample playback path. */
  source?: "omnivoice" | "fish-speech";
  /** Optional metadata shown alongside Fish Speech voices. */
  language?: string;
  country?: string;
  /** Direct preview URL, used instead of regenerating a sample via OmniVoice. */
  previewUrl?: string;
}

export const OMNIVOICE_PRESETS: OmniVoicePreset[] = [
  // --- American English ---
  {
    id: "ov-us-warm-female",
    name: "Warm US Woman",
    tagline: "Friendly, natural, mid-pitch",
    initials: "WF",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-us-deep-male",
    name: "Deep US Narrator",
    tagline: "Authoritative, documentary-style",
    initials: "DN",
    gender: "Male / 男",
    age: "Middle-aged / 中年",
    pitch: "Low Pitch / 低音调",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-us-young-bright",
    name: "Bright US Voice",
    tagline: "Young, energetic, upbeat",
    initials: "BY",
    gender: "Female / 女",
    age: "Teenager / 少年",
    pitch: "High Pitch / 高音调",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-us-grandpa",
    name: "US Grandpa",
    tagline: "Warm, elderly, storytelling",
    initials: "GP",
    gender: "Male / 男",
    age: "Elderly / 老年",
    pitch: "Low Pitch / 低音调",
    accent: "American Accent / 美式口音",
  },
  // --- British English ---
  {
    id: "ov-uk-classy-female",
    name: "British Lady",
    tagline: "Refined, polished RP",
    initials: "BL",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "British Accent / 英国口音",
  },
  {
    id: "ov-uk-deep-male",
    name: "British Gentleman",
    tagline: "Deep, classic narrator",
    initials: "BG",
    gender: "Male / 男",
    age: "Middle-aged / 中年",
    pitch: "Low Pitch / 低音调",
    accent: "British Accent / 英国口音",
  },
  {
    id: "ov-uk-young-boy",
    name: "British Boy",
    tagline: "Youthful, energetic",
    initials: "BB",
    gender: "Male / 男",
    age: "Child / 儿童",
    pitch: "High Pitch / 高音调",
    accent: "British Accent / 英国口音",
  },
  // --- Indian English ---
  {
    id: "ov-in-female-narrator",
    name: "Indian Narrator",
    tagline: "Calm Indian-English narration",
    initials: "IN",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "Indian Accent / 印度口音",
  },
  {
    id: "ov-in-male-young",
    name: "Indian Young Man",
    tagline: "Bright, conversational",
    initials: "IY",
    gender: "Male / 男",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "Indian Accent / 印度口音",
  },
  // --- Australian / Canadian ---
  {
    id: "ov-au-female",
    name: "Aussie Woman",
    tagline: "Warm Australian",
    initials: "AW",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "Australian Accent / 澳大利亚口音",
  },
  {
    id: "ov-ca-male",
    name: "Canadian Guy",
    tagline: "Relaxed, friendly",
    initials: "CM",
    gender: "Male / 男",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "Canadian Accent / 加拿大口音",
  },
  // --- Kids ---
  {
    id: "ov-child-girl",
    name: "Little Girl",
    tagline: "Cute child voice",
    initials: "LG",
    gender: "Female / 女",
    age: "Child / 儿童",
    pitch: "Very High Pitch / 极高音调",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-child-boy",
    name: "Little Boy",
    tagline: "Playful child",
    initials: "LB",
    gender: "Male / 男",
    age: "Child / 儿童",
    pitch: "High Pitch / 高音调",
    accent: "American Accent / 美式口音",
  },
  // --- Style presets ---
  {
    id: "ov-whisper-female",
    name: "Whispering Woman",
    tagline: "Soft whisper",
    initials: "WW",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    style: "Whisper / 耳语",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-whisper-male",
    name: "Whispering Man",
    tagline: "Intimate, quiet",
    initials: "WM",
    gender: "Male / 男",
    age: "Middle-aged / 中年",
    pitch: "Low Pitch / 低音调",
    style: "Whisper / 耳语",
    accent: "American Accent / 美式口音",
  },
  {
    id: "ov-villain",
    name: "Villain",
    tagline: "Deep, menacing",
    initials: "VL",
    gender: "Male / 男",
    age: "Middle-aged / 中年",
    pitch: "Very Low Pitch / 极低音调",
    accent: "British Accent / 英国口音",
  },
  {
    id: "ov-elderly-wise",
    name: "Wise Elder",
    tagline: "Slow, wise, elderly",
    initials: "WE",
    gender: "Male / 男",
    age: "Elderly / 老年",
    pitch: "Low Pitch / 低音调",
    accent: "British Accent / 英国口音",
  },
  {
    id: "ov-teen-bright",
    name: "Teen Girl",
    tagline: "Bright teenage",
    initials: "TG",
    gender: "Female / 女",
    age: "Teenager / 少年",
    pitch: "High Pitch / 高音调",
    accent: "American Accent / 美式口音",
  },
  // --- Chinese variants ---
  {
    id: "ov-cn-female",
    name: "Chinese Woman",
    tagline: "Native Mandarin",
    initials: "CN",
    gender: "Female / 女",
    age: "Young Adult / 青年",
    pitch: "Moderate Pitch / 中音调",
    accent: "Chinese Accent / 中国口音",
  },
  {
    id: "ov-cn-male",
    name: "Chinese Man",
    tagline: "Native Mandarin",
    initials: "CM",
    gender: "Male / 男",
    age: "Middle-aged / 中年",
    pitch: "Low Pitch / 低音调",
    accent: "Chinese Accent / 中国口音",
  },
];

export function getPresetById(id: string): OmniVoicePreset | undefined {
  return OMNIVOICE_PRESETS.find((p) => p.id === id);
}
