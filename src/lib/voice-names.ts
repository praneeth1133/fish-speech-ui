export interface VoiceNameInfo {
  displayName: string;
  language: string;
  gender: "male" | "female";
  languageCode: string;
  avatarInitials: string;
  tagline: string;
}

export const LANGUAGE_COLORS: Record<string, { bg: string; text: string; glow: string; ring: string }> = {
  english: { bg: "bg-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/20", ring: "ring-blue-500/40" },
  spanish: { bg: "bg-amber-500/20", text: "text-amber-400", glow: "shadow-amber-500/20", ring: "ring-amber-500/40" },
  hindi: { bg: "bg-orange-500/20", text: "text-orange-400", glow: "shadow-orange-500/20", ring: "ring-orange-500/40" },
  telugu: { bg: "bg-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/20", ring: "ring-emerald-500/40" },
  kannada: { bg: "bg-purple-500/20", text: "text-purple-400", glow: "shadow-purple-500/20", ring: "ring-purple-500/40" },
};

export const LANGUAGE_AVATAR_BG: Record<string, string> = {
  english: "bg-blue-600",
  spanish: "bg-amber-600",
  hindi: "bg-orange-600",
  telugu: "bg-emerald-600",
  kannada: "bg-purple-600",
};

export const VOICE_NAME_MAP: Record<string, VoiceNameInfo> = {
  // English Male
  "english-male-1": { displayName: "James", language: "English", gender: "male", languageCode: "en", avatarInitials: "JM", tagline: "Clear & authoritative" },
  "english-male-2": { displayName: "Oliver", language: "English", gender: "male", languageCode: "en", avatarInitials: "OL", tagline: "Warm & friendly" },
  "english-male-3": { displayName: "William", language: "English", gender: "male", languageCode: "en", avatarInitials: "WL", tagline: "Deep & resonant" },
  "english-male-4": { displayName: "Benjamin", language: "English", gender: "male", languageCode: "en", avatarInitials: "BN", tagline: "Energetic & upbeat" },
  "english-male-5": { displayName: "Alexander", language: "English", gender: "male", languageCode: "en", avatarInitials: "AX", tagline: "Calm & professional" },
  // English Female
  "english-female-1": { displayName: "Sophia", language: "English", gender: "female", languageCode: "en", avatarInitials: "SO", tagline: "Elegant & smooth" },
  "english-female-2": { displayName: "Emma", language: "English", gender: "female", languageCode: "en", avatarInitials: "EM", tagline: "Bright & cheerful" },
  "english-female-3": { displayName: "Charlotte", language: "English", gender: "female", languageCode: "en", avatarInitials: "CH", tagline: "Soft & soothing" },
  "english-female-4": { displayName: "Isabella", language: "English", gender: "female", languageCode: "en", avatarInitials: "IS", tagline: "Confident & clear" },
  "english-female-5": { displayName: "Amelia", language: "English", gender: "female", languageCode: "en", avatarInitials: "AM", tagline: "Natural & expressive" },

  // Spanish Male
  "spanish-male-1": { displayName: "Mateo", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "MT", tagline: "Rico y expresivo" },
  "spanish-male-2": { displayName: "Santiago", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "SG", tagline: "Fuerte y claro" },
  "spanish-male-3": { displayName: "Diego", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "DG", tagline: "Suave y natural" },
  "spanish-male-4": { displayName: "Alejandro", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "AJ", tagline: "Profundo y cálido" },
  "spanish-male-5": { displayName: "Carlos", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "CR", tagline: "Dinámico y versátil" },
  // Spanish Female
  "spanish-female-1": { displayName: "Valentina", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "VL", tagline: "Dulce y melodiosa" },
  "spanish-female-2": { displayName: "Camila", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "CM", tagline: "Vibrante y alegre" },
  "spanish-female-3": { displayName: "Lucia", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "LC", tagline: "Elegante y suave" },
  "spanish-female-4": { displayName: "Mariana", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "MR", tagline: "Cálida y cercana" },
  "spanish-female-5": { displayName: "Elena", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "EL", tagline: "Clara y profesional" },

  // Hindi Male
  "hindi-male-1": { displayName: "Arjun", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "AJ", tagline: "Strong & confident" },
  "hindi-male-2": { displayName: "Rohan", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "RH", tagline: "Warm & relatable" },
  "hindi-male-3": { displayName: "Vikram", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "VK", tagline: "Deep & commanding" },
  "hindi-male-4": { displayName: "Aditya", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "AD", tagline: "Youthful & energetic" },
  "hindi-male-5": { displayName: "Kabir", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "KB", tagline: "Calm & measured" },
  // Hindi Female
  "hindi-female-1": { displayName: "Priya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "PR", tagline: "Sweet & melodic" },
  "hindi-female-2": { displayName: "Ananya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "AN", tagline: "Bright & lively" },
  "hindi-female-3": { displayName: "Diya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "DY", tagline: "Soft & graceful" },
  "hindi-female-4": { displayName: "Meera", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "MR", tagline: "Expressive & warm" },
  "hindi-female-5": { displayName: "Kavya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "KV", tagline: "Clear & articulate" },

  // Telugu Male
  "telugu-male-1": { displayName: "Ravi", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "RV", tagline: "Bold & resonant" },
  "telugu-male-2": { displayName: "Karthik", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "KR", tagline: "Smooth & natural" },
  "telugu-male-3": { displayName: "Srinivas", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "SR", tagline: "Rich & deep" },
  "telugu-male-4": { displayName: "Venkat", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "VN", tagline: "Energetic & crisp" },
  "telugu-male-5": { displayName: "Harsha", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "HR", tagline: "Friendly & warm" },
  // Telugu Female
  "telugu-female-1": { displayName: "Lakshmi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "LK", tagline: "Graceful & clear" },
  "telugu-female-2": { displayName: "Keerthi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "KE", tagline: "Vibrant & expressive" },
  "telugu-female-3": { displayName: "Swathi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "SW", tagline: "Melodic & smooth" },
  "telugu-female-4": { displayName: "Divya", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "DV", tagline: "Soft & soothing" },
  "telugu-female-5": { displayName: "Anitha", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "AT", tagline: "Bright & cheerful" },

  // Kannada Male
  "kannada-male-1": { displayName: "Naveen", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "NV", tagline: "Strong & articulate" },
  "kannada-male-2": { displayName: "Prakash", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "PK", tagline: "Warm & natural" },
  "kannada-male-3": { displayName: "Suresh", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "SU", tagline: "Deep & steady" },
  "kannada-male-4": { displayName: "Ganesh", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "GN", tagline: "Lively & engaging" },
  "kannada-male-5": { displayName: "Kiran", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "KR", tagline: "Calm & composed" },
  // Kannada Female
  "kannada-female-1": { displayName: "Akshatha", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "AK", tagline: "Elegant & clear" },
  "kannada-female-2": { displayName: "Rashmi", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "RM", tagline: "Sweet & expressive" },
  "kannada-female-3": { displayName: "Sahana", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "SH", tagline: "Melodious & soft" },
  "kannada-female-4": { displayName: "Deepa", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "DP", tagline: "Bright & confident" },
  "kannada-female-5": { displayName: "Chaitra", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "CT", tagline: "Natural & warm" },
};

export function getVoiceDisplayInfo(voiceId: string): VoiceNameInfo | null {
  const cleanId = voiceId.replace(/^ref:/, "");
  return VOICE_NAME_MAP[cleanId] ?? null;
}

export function getLanguageFromId(voiceId: string): string {
  const cleanId = voiceId.replace(/^ref:/, "");
  const parts = cleanId.split("-");
  return parts[0] || "other";
}

export const LANGUAGES = ["english", "spanish", "hindi", "telugu", "kannada"] as const;
export type LanguageKey = (typeof LANGUAGES)[number];
