export interface VoiceNameInfo {
  displayName: string;
  language: string;
  gender: "male" | "female";
  languageCode: string;
  avatarInitials: string;
  tagline: string;
  /** Country of origin (e.g. "United States", "India", "International") */
  country: string;
  /** 2-letter country code used for filtering */
  countryCode: string;
  /** Approximate age bucket: "kid" (<15), "young" (15-24), "adult" (25-39), "older" (40+) */
  ageBucket: "kid" | "young" | "adult" | "older";
  /** Exact age if known (from dataset), otherwise null */
  age: number | null;
  /** Source dataset so we can show attribution (VCTK voices need CC-BY credit) */
  source?: "fish-speech-builtin" | "vctk";
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
  // ─────────────────────────────────────────────────────────────────────────
  // Fish Speech S2 Pro built-in voices (50)
  // These synthetic voices aren't tied to a specific country of origin.
  // ─────────────────────────────────────────────────────────────────────────

  // English Male — International
  "english-male-1": { displayName: "James", language: "English", gender: "male", languageCode: "en", avatarInitials: "JM", tagline: "Clear & authoritative", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "english-male-2": { displayName: "Oliver", language: "English", gender: "male", languageCode: "en", avatarInitials: "OL", tagline: "Warm & friendly", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "english-male-3": { displayName: "William", language: "English", gender: "male", languageCode: "en", avatarInitials: "WL", tagline: "Deep & resonant", country: "International", countryCode: "xx", ageBucket: "older", age: null, source: "fish-speech-builtin" },
  "english-male-4": { displayName: "Benjamin", language: "English", gender: "male", languageCode: "en", avatarInitials: "BN", tagline: "Energetic & upbeat", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "english-male-5": { displayName: "Alexander", language: "English", gender: "male", languageCode: "en", avatarInitials: "AX", tagline: "Calm & professional", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },

  // English Female
  "english-female-1": { displayName: "Sophia", language: "English", gender: "female", languageCode: "en", avatarInitials: "SO", tagline: "Elegant & smooth", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "english-female-2": { displayName: "Emma", language: "English", gender: "female", languageCode: "en", avatarInitials: "EM", tagline: "Bright & cheerful", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "english-female-3": { displayName: "Charlotte", language: "English", gender: "female", languageCode: "en", avatarInitials: "CH", tagline: "Soft & soothing", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "english-female-4": { displayName: "Isabella", language: "English", gender: "female", languageCode: "en", avatarInitials: "IS", tagline: "Confident & clear", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "english-female-5": { displayName: "Amelia", language: "English", gender: "female", languageCode: "en", avatarInitials: "AM", tagline: "Natural & expressive", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },

  // Spanish Male
  "spanish-male-1": { displayName: "Mateo", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "MT", tagline: "Rico y expresivo", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "spanish-male-2": { displayName: "Santiago", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "SG", tagline: "Fuerte y claro", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "spanish-male-3": { displayName: "Diego", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "DG", tagline: "Suave y natural", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "spanish-male-4": { displayName: "Alejandro", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "AJ", tagline: "Profundo y cálido", country: "International", countryCode: "xx", ageBucket: "older", age: null, source: "fish-speech-builtin" },
  "spanish-male-5": { displayName: "Carlos", language: "Spanish", gender: "male", languageCode: "es", avatarInitials: "CR", tagline: "Dinámico y versátil", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },

  // Spanish Female
  "spanish-female-1": { displayName: "Valentina", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "VL", tagline: "Dulce y melodiosa", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "spanish-female-2": { displayName: "Camila", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "CM", tagline: "Vibrante y alegre", country: "International", countryCode: "xx", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "spanish-female-3": { displayName: "Lucia", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "LC", tagline: "Elegante y suave", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "spanish-female-4": { displayName: "Mariana", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "MR", tagline: "Cálida y cercana", country: "International", countryCode: "xx", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "spanish-female-5": { displayName: "Elena", language: "Spanish", gender: "female", languageCode: "es", avatarInitials: "EL", tagline: "Clara y profesional", country: "International", countryCode: "xx", ageBucket: "older", age: null, source: "fish-speech-builtin" },

  // Hindi Male — India
  "hindi-male-1": { displayName: "Arjun", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "AJ", tagline: "Strong & confident", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "hindi-male-2": { displayName: "Rohan", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "RH", tagline: "Warm & relatable", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "hindi-male-3": { displayName: "Vikram", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "VK", tagline: "Deep & commanding", country: "India", countryCode: "in", ageBucket: "older", age: null, source: "fish-speech-builtin" },
  "hindi-male-4": { displayName: "Aditya", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "AD", tagline: "Youthful & energetic", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "hindi-male-5": { displayName: "Kabir", language: "Hindi", gender: "male", languageCode: "hi", avatarInitials: "KB", tagline: "Calm & measured", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },

  // Hindi Female — India
  "hindi-female-1": { displayName: "Priya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "PR", tagline: "Sweet & melodic", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "hindi-female-2": { displayName: "Ananya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "AN", tagline: "Bright & lively", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "hindi-female-3": { displayName: "Diya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "DY", tagline: "Soft & graceful", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "hindi-female-4": { displayName: "Meera", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "MR", tagline: "Expressive & warm", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "hindi-female-5": { displayName: "Kavya", language: "Hindi", gender: "female", languageCode: "hi", avatarInitials: "KV", tagline: "Clear & articulate", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },

  // Telugu Male — India
  "telugu-male-1": { displayName: "Ravi", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "RV", tagline: "Bold & resonant", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "telugu-male-2": { displayName: "Karthik", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "KR", tagline: "Smooth & natural", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "telugu-male-3": { displayName: "Srinivas", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "SR", tagline: "Rich & deep", country: "India", countryCode: "in", ageBucket: "older", age: null, source: "fish-speech-builtin" },
  "telugu-male-4": { displayName: "Venkat", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "VN", tagline: "Energetic & crisp", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "telugu-male-5": { displayName: "Harsha", language: "Telugu", gender: "male", languageCode: "te", avatarInitials: "HR", tagline: "Friendly & warm", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },

  // Telugu Female — India
  "telugu-female-1": { displayName: "Lakshmi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "LK", tagline: "Graceful & clear", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "telugu-female-2": { displayName: "Keerthi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "KE", tagline: "Vibrant & expressive", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "telugu-female-3": { displayName: "Swathi", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "SW", tagline: "Melodic & smooth", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "telugu-female-4": { displayName: "Divya", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "DV", tagline: "Soft & soothing", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "telugu-female-5": { displayName: "Anitha", language: "Telugu", gender: "female", languageCode: "te", avatarInitials: "AT", tagline: "Bright & cheerful", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },

  // Kannada Male — India
  "kannada-male-1": { displayName: "Naveen", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "NV", tagline: "Strong & articulate", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "kannada-male-2": { displayName: "Prakash", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "PK", tagline: "Warm & natural", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "kannada-male-3": { displayName: "Suresh", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "SU", tagline: "Deep & steady", country: "India", countryCode: "in", ageBucket: "older", age: null, source: "fish-speech-builtin" },
  "kannada-male-4": { displayName: "Ganesh", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "GN", tagline: "Lively & engaging", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "kannada-male-5": { displayName: "Kiran", language: "Kannada", gender: "male", languageCode: "kn", avatarInitials: "KR", tagline: "Calm & composed", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },

  // Kannada Female — India
  "kannada-female-1": { displayName: "Akshatha", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "AK", tagline: "Elegant & clear", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "kannada-female-2": { displayName: "Rashmi", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "RM", tagline: "Sweet & expressive", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },
  "kannada-female-3": { displayName: "Sahana", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "SH", tagline: "Melodious & soft", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "kannada-female-4": { displayName: "Deepa", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "DP", tagline: "Bright & confident", country: "India", countryCode: "in", ageBucket: "adult", age: null, source: "fish-speech-builtin" },
  "kannada-female-5": { displayName: "Chaitra", language: "Kannada", gender: "female", languageCode: "kn", avatarInitials: "CT", tagline: "Natural & warm", country: "India", countryCode: "in", ageBucket: "young", age: null, source: "fish-speech-builtin" },

  // ─────────────────────────────────────────────────────────────────────────
  // VCTK — CSTR University of Edinburgh (CC-BY 4.0)
  // https://datashare.ed.ac.uk/handle/10283/3443
  // 25 additional voices across 8 countries, real human speakers.
  // ─────────────────────────────────────────────────────────────────────────

  // United States
  "vctk-us-female-adult-p294": { displayName: "Olivia", language: "English", gender: "female", languageCode: "en", avatarInitials: "OL", tagline: "Friendly American", country: "United States", countryCode: "us", ageBucket: "adult", age: 33, source: "vctk" },
  "vctk-us-female-adult-p362": { displayName: "Hannah", language: "English", gender: "female", languageCode: "en", avatarInitials: "HN", tagline: "Confident American", country: "United States", countryCode: "us", ageBucket: "adult", age: 29, source: "vctk" },
  "vctk-us-female-young-p361": { displayName: "Emily", language: "English", gender: "female", languageCode: "en", avatarInitials: "EM", tagline: "Bright young American", country: "United States", countryCode: "us", ageBucket: "young", age: 19, source: "vctk" },
  "vctk-us-male-young-p360": { displayName: "Tyler", language: "English", gender: "male", languageCode: "en", avatarInitials: "TY", tagline: "Casual young American", country: "United States", countryCode: "us", ageBucket: "young", age: 19, source: "vctk" },

  // United Kingdom (England)
  "vctk-uk-female-young-p225": { displayName: "Amelia", language: "English", gender: "female", languageCode: "en", avatarInitials: "AM", tagline: "Southern English", country: "United Kingdom", countryCode: "uk", ageBucket: "young", age: 23, source: "vctk" },
  "vctk-uk-female-young-p228": { displayName: "Lily", language: "English", gender: "female", languageCode: "en", avatarInitials: "LI", tagline: "Bright English", country: "United Kingdom", countryCode: "uk", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-uk-female-young-p229": { displayName: "Harriet", language: "English", gender: "female", languageCode: "en", avatarInitials: "HA", tagline: "Elegant English", country: "United Kingdom", countryCode: "uk", ageBucket: "young", age: 23, source: "vctk" },
  "vctk-uk-male-adult-p227": { displayName: "George", language: "English", gender: "male", languageCode: "en", avatarInitials: "GE", tagline: "Mature English", country: "United Kingdom", countryCode: "uk", ageBucket: "adult", age: 38, source: "vctk" },
  "vctk-uk-male-young-p226": { displayName: "Oliver", language: "English", gender: "male", languageCode: "en", avatarInitials: "OL", tagline: "Surrey English", country: "United Kingdom", countryCode: "uk", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-uk-male-young-p270": { displayName: "Oscar", language: "English", gender: "male", languageCode: "en", avatarInitials: "OS", tagline: "Crisp English", country: "United Kingdom", countryCode: "uk", ageBucket: "young", age: 21, source: "vctk" },

  // Scotland
  "vctk-sc-female-young-p249": { displayName: "Isla", language: "English", gender: "female", languageCode: "en", avatarInitials: "IS", tagline: "Scottish charm", country: "Scotland", countryCode: "sc", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-sc-male-young-p247": { displayName: "Callum", language: "English", gender: "male", languageCode: "en", avatarInitials: "CA", tagline: "Scottish brogue", country: "Scotland", countryCode: "sc", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-sc-male-young-p252": { displayName: "Fraser", language: "English", gender: "male", languageCode: "en", avatarInitials: "FR", tagline: "Highland Scottish", country: "Scotland", countryCode: "sc", ageBucket: "young", age: 22, source: "vctk" },

  // Ireland
  "vctk-ie-female-young-p288": { displayName: "Niamh", language: "English", gender: "female", languageCode: "en", avatarInitials: "NI", tagline: "Irish lilt", country: "Ireland", countryCode: "ie", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-ie-female-young-p313": { displayName: "Aoife", language: "English", gender: "female", languageCode: "en", avatarInitials: "AO", tagline: "Dublin Irish", country: "Ireland", countryCode: "ie", ageBucket: "young", age: 24, source: "vctk" },

  // Northern Ireland
  "vctk-ni-female-young-p293": { displayName: "Caoimhe", language: "English", gender: "female", languageCode: "en", avatarInitials: "CA", tagline: "N. Irish accent", country: "Northern Ireland", countryCode: "ni", ageBucket: "young", age: 22, source: "vctk" },
  "vctk-ni-female-young-p351": { displayName: "Ciara", language: "English", gender: "female", languageCode: "en", avatarInitials: "CI", tagline: "Belfast Irish", country: "Northern Ireland", countryCode: "ni", ageBucket: "young", age: 21, source: "vctk" },
  "vctk-ni-male-young-p292": { displayName: "Conor", language: "English", gender: "male", languageCode: "en", avatarInitials: "CO", tagline: "Belfast brogue", country: "Northern Ireland", countryCode: "ni", ageBucket: "young", age: 23, source: "vctk" },

  // Canada
  "vctk-ca-female-young-p312": { displayName: "Chloe", language: "English", gender: "female", languageCode: "en", avatarInitials: "CH", tagline: "Bright Canadian", country: "Canada", countryCode: "ca", ageBucket: "young", age: 19, source: "vctk" },
  "vctk-ca-female-young-p317": { displayName: "Madison", language: "English", gender: "female", languageCode: "en", avatarInitials: "MA", tagline: "Friendly Canadian", country: "Canada", countryCode: "ca", ageBucket: "young", age: 23, source: "vctk" },
  "vctk-ca-male-young-p316": { displayName: "Ethan", language: "English", gender: "male", languageCode: "en", avatarInitials: "ET", tagline: "Casual Canadian", country: "Canada", countryCode: "ca", ageBucket: "young", age: 20, source: "vctk" },
  "vctk-ca-male-young-p363": { displayName: "Liam", language: "English", gender: "male", languageCode: "en", avatarInitials: "LI", tagline: "Warm Canadian", country: "Canada", countryCode: "ca", ageBucket: "young", age: 22, source: "vctk" },

  // India (English accent)
  "vctk-in-female-young-p248": { displayName: "Anjali", language: "English", gender: "female", languageCode: "en", avatarInitials: "AN", tagline: "Indian English", country: "India", countryCode: "in", ageBucket: "young", age: 23, source: "vctk" },
  "vctk-in-male-adult-p251": { displayName: "Rajesh", language: "English", gender: "male", languageCode: "en", avatarInitials: "RA", tagline: "Professional Indian", country: "India", countryCode: "in", ageBucket: "adult", age: 26, source: "vctk" },

  // South Africa
  "vctk-za-female-adult-p314": { displayName: "Leah", language: "English", gender: "female", languageCode: "en", avatarInitials: "LE", tagline: "South African", country: "South Africa", countryCode: "za", ageBucket: "adult", age: 26, source: "vctk" },

  // ─────────────────────────────────────────────────────────────────────────
  // Kid voices (15) — pitch-shifted VCTK young adults to sound child-like.
  // ─────────────────────────────────────────────────────────────────────────
  "kid-us-girl-1":       { displayName: "Lily",   language: "English", gender: "female", languageCode: "en", avatarInitials: "LI", tagline: "Cheerful US girl",     country: "United States",    countryCode: "us", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-us-girl-2":       { displayName: "Chloe",  language: "English", gender: "female", languageCode: "en", avatarInitials: "CH", tagline: "Gentle US girl",       country: "United States",    countryCode: "us", ageBucket: "kid", age: 10, source: "vctk" },
  "kid-us-boy-1":        { displayName: "Tommy",  language: "English", gender: "male",   languageCode: "en", avatarInitials: "TO", tagline: "Friendly US boy",      country: "United States",    countryCode: "us", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-uk-girl-1":       { displayName: "Poppy",  language: "English", gender: "female", languageCode: "en", avatarInitials: "PO", tagline: "Proper UK girl",       country: "United Kingdom",   countryCode: "uk", ageBucket: "kid", age: 8,  source: "vctk" },
  "kid-uk-girl-2":       { displayName: "Daisy",  language: "English", gender: "female", languageCode: "en", avatarInitials: "DA", tagline: "Warm UK girl",         country: "United Kingdom",   countryCode: "uk", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-uk-boy-1":        { displayName: "Harry",  language: "English", gender: "male",   languageCode: "en", avatarInitials: "HA", tagline: "Polite UK boy",        country: "United Kingdom",   countryCode: "uk", ageBucket: "kid", age: 8,  source: "vctk" },
  "kid-uk-boy-2":        { displayName: "Leo",    language: "English", gender: "male",   languageCode: "en", avatarInitials: "LE", tagline: "Curious UK boy",       country: "United Kingdom",   countryCode: "uk", ageBucket: "kid", age: 10, source: "vctk" },
  "kid-canada-girl-1":   { displayName: "Mia",    language: "English", gender: "female", languageCode: "en", avatarInitials: "MI", tagline: "Bright Canadian girl", country: "Canada",           countryCode: "ca", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-canada-boy-1":    { displayName: "Noah",   language: "English", gender: "male",   languageCode: "en", avatarInitials: "NO", tagline: "Upbeat Canadian boy",  country: "Canada",           countryCode: "ca", ageBucket: "kid", age: 10, source: "vctk" },
  "kid-ireland-girl-1":  { displayName: "Aisling",language: "English", gender: "female", languageCode: "en", avatarInitials: "AI", tagline: "Bright Irish girl",    country: "Ireland",          countryCode: "ie", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-ireland-boy-1":   { displayName: "Rory",   language: "English", gender: "male",   languageCode: "en", avatarInitials: "RO", tagline: "Lively N. Irish boy",  country: "Northern Ireland", countryCode: "ni", ageBucket: "kid", age: 10, source: "vctk" },
  "kid-scotland-girl-1": { displayName: "Isla",   language: "English", gender: "female", languageCode: "en", avatarInitials: "IS", tagline: "Sweet Scottish girl",  country: "Scotland",         countryCode: "sc", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-scotland-boy-1":  { displayName: "Finn",   language: "English", gender: "male",   languageCode: "en", avatarInitials: "FI", tagline: "Brave Scottish boy",   country: "Scotland",         countryCode: "sc", ageBucket: "kid", age: 10, source: "vctk" },
  "kid-india-girl-1":    { displayName: "Anaya",  language: "English", gender: "female", languageCode: "en", avatarInitials: "AN", tagline: "Bright Indian girl",   country: "India",            countryCode: "in", ageBucket: "kid", age: 9,  source: "vctk" },
  "kid-india-boy-1":     { displayName: "Arjun",  language: "English", gender: "male",   languageCode: "en", avatarInitials: "AR", tagline: "Smart Indian boy",     country: "India",            countryCode: "in", ageBucket: "kid", age: 10, source: "vctk" },
};

export function getVoiceDisplayInfo(voiceId: string): VoiceNameInfo | null {
  const cleanId = voiceId.replace(/^ref:/, "");
  return VOICE_NAME_MAP[cleanId] ?? null;
}

export function getLanguageFromId(voiceId: string): string {
  const cleanId = voiceId.replace(/^ref:/, "");
  // VCTK ids look like "vctk-{cc}-{gender}-{age}-{speaker}" — those are all English
  if (cleanId.startsWith("vctk-")) return "english";
  const parts = cleanId.split("-");
  return parts[0] || "other";
}

export const LANGUAGES = ["english", "spanish", "hindi", "telugu", "kannada"] as const;
export type LanguageKey = (typeof LANGUAGES)[number];

/** Countries available for filtering (derived from VOICE_NAME_MAP). */
export const COUNTRIES = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "uk", name: "United Kingdom", flag: "🇬🇧" },
  { code: "sc", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { code: "ie", name: "Ireland", flag: "🇮🇪" },
  { code: "ni", name: "Northern Ireland", flag: "🇬🇧" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "nz", name: "New Zealand", flag: "🇳🇿" },
  { code: "za", name: "South Africa", flag: "🇿🇦" },
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "xx", name: "International", flag: "🌐" },
] as const;

export const AGE_BUCKETS = [
  { id: "kid", label: "Kid", hint: "Child voices" },
  { id: "young", label: "Young", hint: "Under 25" },
  { id: "adult", label: "Adult", hint: "25–39" },
  { id: "older", label: "Older", hint: "40+" },
] as const;
