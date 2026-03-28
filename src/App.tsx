import { useState, useRef, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";

// ─── Types ───
interface StoryPart { id: string; type: "character"|"place"|"event"; text: string; }
interface Story { id: string; title: string; rawInput: string[]; parts: StoryPart[]; pages: {text:string; imageUrl?:string}[]; createdAt: number; lang: "en"|"ar"; coverImageUrl?: string; authorName?: string; }
type StoryLang = "en"|"ar";
type Screen = "library"|"brainstorm"|"story"|"pictures"|"settings"|"apisetup";

interface VoiceConfig { voiceURI?: string; voiceName?: string; speed: number; pitch: number; }

interface ClaudeQuestion { id: string; question: string; answered: boolean; answer?: string; }

const PALETTES = [
  { bg:"#EDE9FE", accent:"#7C3AED", text:"#4C1D95", light:"#F5F3FF" },
  { bg:"#D1FAE5", accent:"#059669", text:"#064E3B", light:"#ECFDF5" },
  { bg:"#FEE2E2", accent:"#DC2626", text:"#7F1D1D", light:"#FEF2F2" },
  { bg:"#DBEAFE", accent:"#2563EB", text:"#1E3A5F", light:"#EFF6FF" },
  { bg:"#FEF3C7", accent:"#D97706", text:"#78350F", light:"#FFFBEB" },
  { bg:"#FCE7F3", accent:"#DB2777", text:"#831843", light:"#FDF2F8" },
];

const TEST_PHRASES = [
  "Once upon a time, a brave little dragon set off on the most amazing adventure!",
  "The princess laughed as the silly frog jumped into the magical pond.",
  "Deep in the enchanted forest, the trees began to whisper a secret.",
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase(); let s = 0;
  if (name.includes("premium")||name.includes("enhanced")||name.includes("natural")) s+=50;
  if (name.includes("siri")) s+=40;
  if (name.includes("google")&&!name.includes("compact")) s+=35;
  if (name.includes("online")||name.includes("neural")) s+=35;
  const good=["samantha","karen","moira","fiona","tessa","daniel","alex","victoria","allison","ava","susan","zoe","nicky","tom","oliver"];
  if (good.some(n=>name.includes(n))) s+=25;
  if (v.lang.startsWith("en")) s+=20;
  if (name.includes("compact")||name.includes("espeak")) s-=30;
  return s;
}
function cleanVoiceName(n:string){return n.replace(/Microsoft |Google |Apple |com\.apple\.\w+\./g,"").replace(/\s*\(.*?\)\s*/g,"").replace(/Online\s*$/i,"").trim();}
function getVoiceTag(v:SpeechSynthesisVoice){const n=v.name.toLowerCase();if(n.includes("premium")||n.includes("enhanced")||n.includes("natural"))return"Best quality";if(n.includes("siri"))return"Siri voice";if(n.includes("google")&&!n.includes("compact"))return"Google HD";if(n.includes("online")||n.includes("neural"))return"Neural";return null;}

// ─── Icons ───
const Mic=({s=28}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" fill="currentColor"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" fill="currentColor"/></svg>;
const Speaker=({s=28}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor" opacity={.6}/><path d="M19 12c0-3.53-2.04-6.58-5-8.05v2.18c1.82 1.3 3 3.46 3 5.87s-1.18 4.57-3 5.87v2.18c2.96-1.47 5-4.52 5-8.05z" fill="currentColor" opacity={.3}/></svg>;
const Book=({s=28}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" fill="currentColor"/></svg>;
const Plus=()=><svg width={44} height={44} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"/></svg>;
const Back=()=><svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevL=()=><svg width={32} height={32} viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ChevR=()=><svg width={32} height={32} viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>;
const Img=({s=28}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x={3} y={3} width={18} height={18} rx={3} stroke="currentColor" strokeWidth={1.5}/><circle cx={8.5} cy={8.5} r={2} fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"/></svg>;
const Play=()=><svg width={28} height={28} viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>;
const Stop=()=><svg width={28} height={28} viewBox="0 0 24 24" fill="none"><rect x={6} y={6} width={12} height={12} rx={2} fill="currentColor"/></svg>;
const Star=()=><svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const Gear=({s=24}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth={1.8}/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth={1.8}/></svg>;
const Check=()=><svg width={22} height={22} viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>;
const StarSmall=()=><svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
const Sparkle=({s=20}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.09 8.26L20 9.27L15.5 14.14L16.18 21.02L12 17.77L7.82 21.02L8.5 14.14L4 9.27L9.91 8.26L12 2Z"/></svg>;
const DL=({s=20}:{s?:number})=><svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15V3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ─── Karaoke text component ───
function KaraokeText({ text, isReading, currentWordIndex, accentColor }: {
  text: string; isReading: boolean; currentWordIndex: number; accentColor: string;
}) {
  const words = text.split(/\s+/);
  return (
    <div className="karaoke-text">
      {words.map((word, i) => (
        <span key={i} className={`karaoke-word ${isReading && i === currentWordIndex ? "active" : ""} ${isReading && i < currentWordIndex ? "read" : ""}`}
          style={isReading && i === currentWordIndex ? { color: accentColor, borderBottomColor: accentColor } : undefined}
        >{word} </span>
      ))}
    </div>
  );
}

// ─── IndexedDB helpers for image storage ───
const IDB_NAME = "story_sparks_images";
const IDB_STORE = "images";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveImagesToIDB(stories: Story[]) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    for (const s of stories) {
      if (s.coverImageUrl) {
        store.put(s.coverImageUrl, `${s.id}_cover`);
      }
      for (let i = 0; i < s.pages.length; i++) {
        if (s.pages[i].imageUrl) {
          store.put(s.pages[i].imageUrl, `${s.id}_${i}`);
        }
      }
    }
    db.close();
  } catch (e) { console.error("IDB save error:", e); }
}

async function loadImagesFromIDB(): Promise<Record<string, string>> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, "readonly");
    const store = tx.objectStore(IDB_STORE);
    return new Promise((resolve) => {
      const map: Record<string, string> = {};
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          map[cursor.key as string] = cursor.value;
          cursor.continue();
        } else {
          db.close();
          resolve(map);
        }
      };
      req.onerror = () => { db.close(); resolve({}); };
    });
  } catch (e) { console.error("IDB load error:", e); return {}; }
}

// ─── Main App ───
export default function App() {
  const [screen, setScreen] = useState<Screen>("library");
  const [stories, setStories] = useState<Story[]>(()=>{
    try{const s=localStorage.getItem("ss_stories");return s?JSON.parse(s):[];}catch{return [];}
  });
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [rawInputs, setRawInputs] = useState<string[]>([]);
  const [parts, setParts] = useState<StoryPart[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [storyTitle, setStoryTitle] = useState("");
  const [pages, setPages] = useState<{text:string;imageUrl?:string}[]>([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [viewStory, setViewStory] = useState<Story|null>(null);
  const [viewIdx, setViewIdx] = useState(0);
  const [autoListen, setAutoListen] = useState(false);
  const [prevScreen, setPrevScreen] = useState<Screen>("library");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [isKaraokeActive, setIsKaraokeActive] = useState(false);

  // Claude questions
  const [questions, setQuestions] = useState<ClaudeQuestion[]>([]);
  const [answeringQuestion, setAnsweringQuestion] = useState<string|null>(null);
  const [questionTranscript, setQuestionTranscript] = useState("");

  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(()=>{
    try{const s=localStorage.getItem("ss_voice2");if(s){const p=JSON.parse(s);if(p.speed>0.8)p.speed=0.7;return p;}}catch{}
    return {speed:0.7,pitch:1.05};
  });
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [testingVoice, setTestingVoice] = useState<string|null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showAllVoices, setShowAllVoices] = useState(false);

  // API key management
  const [apiKey, setApiKey] = useState<string>(()=>{try{return localStorage.getItem("ss_api_key")||"";}catch{return "";}});
  const [apiKeyInput, setApiKeyInput] = useState("");
  const saveApiKey = (key: string) => { setApiKey(key); try{localStorage.setItem("ss_api_key", key);}catch{} };

  // ElevenLabs
  const [elKey, setElKey] = useState<string>(()=>{try{return localStorage.getItem("ss_el_key")||"";}catch{return "";}});
  const [elKeyInput, setElKeyInput] = useState("");
  const saveElKey = (key: string) => { setElKey(key); try{localStorage.setItem("ss_el_key", key);}catch{} };
  const elAudioRef = useRef<HTMLAudioElement|null>(null);
  const elTimerRef = useRef<number|null>(null);

  // Default ElevenLabs voice IDs (good multilingual voices)
  const [elVoiceEn, setElVoiceEn] = useState<string>(()=>{try{return localStorage.getItem("ss_el_voice_en")||"EXAVITQu4vr4xnSDxMaL";}catch{return "EXAVITQu4vr4xnSDxMaL";}});
  const [elVoiceAr, setElVoiceAr] = useState<string>(()=>{try{return localStorage.getItem("ss_el_voice_ar")||"TX3LPaxmHKxFdv7VOQHJ";}catch{return "TX3LPaxmHKxFdv7VOQHJ";}});
  useEffect(()=>{try{localStorage.setItem("ss_el_voice_en",elVoiceEn);}catch{}},[elVoiceEn]);
  useEffect(()=>{try{localStorage.setItem("ss_el_voice_ar",elVoiceAr);}catch{}},[elVoiceAr]);

  // Gemini (image generation)
  const [geminiKey, setGeminiKey] = useState<string>(()=>{try{return localStorage.getItem("ss_gemini_key")||"";}catch{return "";}});
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const saveGeminiKey = (key: string) => { setGeminiKey(key); try{localStorage.setItem("ss_gemini_key", key);}catch{} };

  // OpenAI Whisper (transcription)
  const [openaiKey, setOpenaiKey] = useState<string>(()=>{try{return localStorage.getItem("ss_openai_key")||"";}catch{return "";}});
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const saveOpenaiKey = (key: string) => { setOpenaiKey(key); try{localStorage.setItem("ss_openai_key", key);}catch{} };
  const mediaRecRef = useRef<MediaRecorder|null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveIntervalRef = useRef<any>(null);
  const questionMediaRecRef = useRef<MediaRecorder|null>(null);
  const questionAudioChunksRef = useRef<Blob[]>([]);

  // Whisper transcription helper
  const transcribeWithWhisper = async (audioBlob: Blob, lang: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", lang === "ar" ? "ar" : "en");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiKey}` },
      body: formData,
    });
    if (!res.ok) { const err = await res.text(); console.error("Whisper error", res.status, err); throw new Error("Whisper API error"); }
    const data = await res.json();
    return data.text || "";
  };

  // Visual styles for illustrations
  const STYLES = [
    { id: "watercolor", name: "Watercolor", emoji: "\ud83c\udfa8", prompt: "soft watercolor children's book illustration, gentle colors, delicate brushstrokes, whimsical and dreamy", bg: "#EDE9FE" },
    { id: "cartoon", name: "Cartoon", emoji: "\ud83d\udcfa", prompt: "bright bold cartoon illustration, vibrant colors, clean lines, fun animated style like a children's TV show", bg: "#DBEAFE" },
    { id: "crayon", name: "Crayon", emoji: "\ud83d\udd8d\ufe0f", prompt: "hand-drawn crayon and colored pencil illustration, childlike art style, textured paper look, warm and playful", bg: "#FEF3C7" },
    { id: "pixel", name: "Pixel Art", emoji: "\ud83d\udc7e", prompt: "cute pixel art illustration, retro 16-bit game style, bright cheerful colors, charming blocky characters", bg: "#D1FAE5" },
    { id: "classic", name: "Storybook", emoji: "\ud83d\udcda", prompt: "traditional storybook illustration, warm detailed painting, golden age children's book art, rich and inviting", bg: "#FCE7F3" },
    { id: "cutout", name: "Paper Cutout", emoji: "\u2702\ufe0f", prompt: "paper cutout collage illustration, layered craft style, textured materials, colorful and tactile looking", bg: "#FEE2E2" },
  ];
  const [storyStyle, setStoryStyle] = useState<string>("watercolor");
  const [characterDesc, setCharacterDesc] = useState<string>("");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState<number>(-1);
  const [redoingPage, setRedoingPage] = useState<number|null>(null);
  const [redoPrompt, setRedoPrompt] = useState("");
  const [editingPageIdx, setEditingPageIdx] = useState<number|null>(null);
  const [editingPageText, setEditingPageText] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [authorName, setAuthorName] = useState<string>("");

  // Per-story language
  const [storyLang, setStoryLang] = useState<StoryLang>("en");

  // Helper for Claude API calls
  const callClaude = async (system: string, userMessage: string, maxTokens = 1000) => {
    if (!apiKey) throw new Error("no-api-key");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    return (data.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim();
  };

  useEffect(()=>{try{localStorage.setItem("ss_voice2",JSON.stringify(voiceConfig));}catch{}},[voiceConfig]);
  // Save stories to localStorage (text only) + IndexedDB (images)
  useEffect(()=>{
    // Strip images for localStorage (5MB limit) — save only text data
    const stripped = stories.map(s => ({
      ...s,
      coverImageUrl: undefined, // drop cover image
      pages: s.pages.map(p => ({ text: p.text })), // drop imageUrl
    }));
    try {
      localStorage.setItem("ss_stories", JSON.stringify(stripped));
    } catch (e) {
      console.error("localStorage save failed:", e);
    }
    // Save images to IndexedDB (much larger limit)
    saveImagesToIDB(stories);
  },[stories]);

  // Load images from IndexedDB on mount
  useEffect(() => {
    loadImagesFromIDB().then(imageMap => {
      if (Object.keys(imageMap).length > 0) {
        setStories(prev => prev.map(s => ({
          ...s,
          coverImageUrl: s.coverImageUrl || imageMap[`${s.id}_cover`] || undefined,
          pages: s.pages.map((p, i) => ({
            ...p,
            imageUrl: p.imageUrl || imageMap[`${s.id}_${i}`] || undefined,
          })),
        })));
      }
    });
  }, []);
  useEffect(()=>{
    if (!window.speechSynthesis) return; // Guard for browsers without speechSynthesis
    const load=()=>{try{const all=window.speechSynthesis.getVoices();const en=all.filter(v=>v.lang.startsWith("en"));const list=en.length>0?en:all;list.sort((a,b)=>scoreVoice(b)-scoreVoice(a));setBrowserVoices(list);if(!voiceConfig.voiceURI&&list.length>0)setVoiceConfig(vc=>({...vc,voiceURI:list[0].voiceURI,voiceName:list[0].name}));}catch(e){console.error("Voice load error:",e);}};
    load();try{window.speechSynthesis.onvoiceschanged=load;}catch(e){console.error("voiceschanged error:",e);}
  },[]);

  // Auto-play audio in listen mode when page changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoListen && viewStory && viewStory.pages[viewIdx]) {
      const lang = viewStory.lang || "en";
      const text = viewStory.pages[viewIdx].text;
      if (text) {
        const timer = setTimeout(() => speakEL(text, lang), 200);
        return () => clearTimeout(timer);
      }
    }
  }, [viewIdx, viewStory, autoListen]);

  // ─── Speak with karaoke ───
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    if (!text) return;
    setIsSpeaking(true);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = voiceConfig.speed; u.pitch = voiceConfig.pitch; u.lang = "en-US";
    if (voiceConfig.voiceURI) { const m = browserVoices.find(v=>v.voiceURI===voiceConfig.voiceURI); if(m) u.voice=m; }

    // Word-by-word tracking via boundary events
    const words = text.split(/\s+/);
    let wordIdx = 0;
    setCurrentWordIdx(0);
    setIsKaraokeActive(true);

    u.onboundary = (e) => {
      if (e.name === "word") {
        // Find which word we're at based on char index
        let charCount = 0;
        for (let i = 0; i < words.length; i++) {
          if (charCount >= e.charIndex) { wordIdx = i; break; }
          charCount += words[i].length + 1;
          if (i === words.length - 1) wordIdx = i;
        }
        setCurrentWordIdx(wordIdx);
      }
    };

    u.onend = () => { setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1); onEnd?.(); };
    u.onerror = () => { setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1); onEnd?.(); };
    if (window.speechSynthesis) window.speechSynthesis.speak(u);
  }, [voiceConfig, browserVoices]);

  // Simple speak without karaoke (for short UI prompts)
  const speakSimple = useCallback((text: string, onEnd?: () => void) => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (!text) return;
    setIsSpeaking(true);
    const u = new SpeechSynthesisUtterance(text);
    u.rate = voiceConfig.speed; u.pitch = voiceConfig.pitch; u.lang = "en-US";
    if (voiceConfig.voiceURI) { const m = browserVoices.find(v=>v.voiceURI===voiceConfig.voiceURI); if(m) u.voice=m; }
    u.onend = () => { setIsSpeaking(false); onEnd?.(); };
    u.onerror = () => { setIsSpeaking(false); onEnd?.(); };
    if (window.speechSynthesis) window.speechSynthesis.speak(u);
  }, [voiceConfig, browserVoices]);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (elAudioRef.current) { elAudioRef.current.pause(); elAudioRef.current.src = ""; elAudioRef.current = null; }
    if (elTimerRef.current) { cancelAnimationFrame(elTimerRef.current); elTimerRef.current = null; }
    setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1); setTestingVoice(null);
  }, []);

  // ─── ElevenLabs TTS with karaoke ───
  const speakEL = useCallback(async (text: string, lang: StoryLang, onEnd?: () => void) => {
    if (!text) { onEnd?.(); return; }
    if (!elKey) { /* No ElevenLabs key — skip voice */ onEnd?.(); return; }
    stopSpeaking();
    setIsSpeaking(true);
    setIsKaraokeActive(true);
    setCurrentWordIdx(0);

    const voiceId = lang === "ar" ? elVoiceAr : elVoiceEn;
    try {
      // Use standard TTS endpoint (returns audio blob directly)
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.6, similarity_boost: 0.8, speed: 0.75 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(()=>"");
        console.error("ElevenLabs error", res.status, errText);
        setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1);
        onEnd?.();
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      elAudioRef.current = audio;

      // Estimate word timing from audio duration using syllable-based weights
      const words = text.split(/\s+/);
      const wordTimings: { start: number; end: number }[] = [];

      // Count syllables in a word (approximate)
      const countSyllables = (word: string): number => {
        const w = word.toLowerCase().replace(/[^a-z]/g, "");
        if (w.length <= 2) return 1;
        let count = 0;
        const vowels = "aeiouy";
        let prevVowel = false;
        for (let i = 0; i < w.length; i++) {
          const isVowel = vowels.includes(w[i]);
          if (isVowel && !prevVowel) count++;
          prevVowel = isVowel;
        }
        // Silent e
        if (w.endsWith("e") && count > 1) count--;
        return Math.max(1, count);
      };

      const buildTimings = () => {
        const dur = audio.duration || (words.length * 0.4);
        // ElevenLabs has ~0.15s lead-in silence
        const leadIn = Math.min(0.15, dur * 0.05);
        const speechDur = dur - leadIn;

        // Weight each word by syllable count + pause after punctuation
        const weights = words.map(w => {
          let wt = countSyllables(w);
          // Add pause time after sentence-ending punctuation
          if (/[.!?]$/.test(w)) wt += 1.5;
          else if (/[,;:]$/.test(w)) wt += 0.6;
          return wt;
        });
        const totalWeight = weights.reduce((a,b) => a+b, 0) || 1;
        let cursor = leadIn;
        for (const wt of weights) {
          const wordDur = (wt / totalWeight) * speechDur;
          wordTimings.push({ start: cursor, end: cursor + wordDur });
          cursor += wordDur;
        }
      };

      const syncKaraoke = () => {
        if (!elAudioRef.current) return;
        const t = elAudioRef.current.currentTime;
        let idx = 0;
        for (let i = 0; i < wordTimings.length; i++) {
          if (t >= wordTimings[i].start) idx = i;
        }
        setCurrentWordIdx(idx);
        if (!elAudioRef.current.paused) {
          elTimerRef.current = requestAnimationFrame(syncKaraoke);
        }
      };

      audio.onloadedmetadata = () => { if (wordTimings.length === 0) buildTimings(); };
      audio.onplay = () => { if (wordTimings.length === 0) buildTimings(); elTimerRef.current = requestAnimationFrame(syncKaraoke); };
      audio.onended = () => {
        setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1);
        if (elTimerRef.current) cancelAnimationFrame(elTimerRef.current);
        URL.revokeObjectURL(url);
        elAudioRef.current = null;
        onEnd?.();
      };
      audio.onerror = () => {
        setIsSpeaking(false); setIsKaraokeActive(false); setCurrentWordIdx(-1);
        URL.revokeObjectURL(url);
        elAudioRef.current = null;
        onEnd?.();
      };
      audio.play();
    } catch (err) {
      console.error("ElevenLabs TTS failed, falling back", err);
      speak(text, onEnd);
    }
  }, [elKey, elVoiceEn, elVoiceAr, speak, stopSpeaking]);

  // Test an ElevenLabs voice
  const [testingEL, setTestingEL] = useState(false);
  const testELVoice = useCallback(async (lang: StoryLang) => {
    const phrase = lang === "ar"
      ? "في يوم من الأيام، انطلق تنين صغير شجاع في مغامرة مذهلة"
      : TEST_PHRASES[Math.floor(Math.random()*TEST_PHRASES.length)];
    setTestingEL(true);
    await speakEL(phrase, lang, () => setTestingEL(false));
  }, [speakEL]);

  const testVoice = useCallback((v: SpeechSynthesisVoice) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); setTestingVoice(v.voiceURI);
    const u = new SpeechSynthesisUtterance(TEST_PHRASES[Math.floor(Math.random()*TEST_PHRASES.length)]);
    u.voice=v; u.rate=voiceConfig.speed; u.pitch=voiceConfig.pitch;
    u.onend=()=>setTestingVoice(null); u.onerror=()=>setTestingVoice(null);
    window.speechSynthesis.speak(u);
  }, [voiceConfig]);

  const [listenStatus, setListenStatus] = useState("");

  // ─── Voice input ───
  const [countdown, setCountdown] = useState<number|null>(null);

  const startListening = useCallback(() => {
    if (!openaiKey) { speakEL("Please add your OpenAI key in settings first.", storyLang); return; }

    // Stop any ongoing speech first
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    // 3-2-1 countdown then start
    setCountdown(3);
    setTimeout(()=>setCountdown(2), 500);
    setTimeout(()=>setCountdown(1), 1000);
    setTimeout(()=>{
      setCountdown(null);
      actuallyStartListening();
    }, 1500);
  }, [storyLang, openaiKey]);

  const actuallyStartListening = useCallback(() => {
    audioChunksRef.current = [];
    setTranscript("");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstart = () => {
        setListenStatus("");
        setIsRecording(true);
      };

      recorder.onerror = () => {
        setListenStatus("Recording error — try again");
        setIsRecording(false);
      };

      // Collect chunks every 300ms for smooth recording
      recorder.start(300);

      // Live transcription: send accumulated audio to Whisper every 2 seconds
      let liveInFlight = false;
      liveIntervalRef.current = setInterval(async () => {
        if (audioChunksRef.current.length === 0 || liveInFlight) return;
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size < 500) return;
          liveInFlight = true;
          const text = await transcribeWithWhisper(blob, storyLang);
          liveInFlight = false;
          if (text.trim()) setTranscript(text.trim());
        } catch (_) { liveInFlight = false; /* ignore interim errors */ }
      }, 2000);

    }).catch(err => {
      console.error("Mic access error:", err);
      if (err.name === "NotAllowedError") {
        setListenStatus("Microphone blocked — ask a grown-up to check settings");
      } else {
        setListenStatus("Can't find your microphone");
      }
    });
  }, [storyLang, openaiKey]);

  // Editing state: after mic stops, user can edit before submitting
  const [editingTranscript, setEditingTranscript] = useState<string|null>(null);
  const editRef = useRef<HTMLTextAreaElement|null>(null);

  const stopListening = useCallback(async () => {
    // Stop live transcription interval
    if (liveIntervalRef.current) { clearInterval(liveIntervalRef.current); liveIntervalRef.current = null; }

    const recorder = mediaRecRef.current;
    mediaRecRef.current = null;
    setIsRecording(false);

    if (!recorder || recorder.state === "inactive") {
      setListenStatus("");
      return;
    }

    setListenStatus("Finishing transcription...");

    // Stop recording and wait for final data
    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    // Stop all mic tracks
    recorder.stream.getTracks().forEach(t => t.stop());

    const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
    audioChunksRef.current = [];

    if (audioBlob.size < 1000) {
      setListenStatus("Recording too short — try again");
      setTimeout(() => setListenStatus(""), 2000);
      setTranscript("");
      return;
    }

    try {
      // Final full transcription for best accuracy
      const text = await transcribeWithWhisper(audioBlob, storyLang);
      setListenStatus("");
      setTranscript("");
      if (text.trim()) {
        setEditingTranscript(text.trim());
      } else {
        setListenStatus("Couldn't hear anything — try again");
        setTimeout(() => setListenStatus(""), 2000);
      }
    } catch (err) {
      console.error("Whisper transcription failed:", err);
      setListenStatus("Transcription failed — check your OpenAI key");
      setTranscript("");
      setTimeout(() => setListenStatus(""), 3000);
    }
  }, [storyLang, openaiKey]);

  const submitEditedTranscript = useCallback(() => {
    if (editingTranscript?.trim()) {
      const t = editingTranscript.trim();
      setRawInputs(p=>[...p, t]);
    }
    setEditingTranscript(null);
  }, [editingTranscript]);

  const discardTranscript = useCallback(() => {
    setEditingTranscript(null);
  }, []);

  // ─── Extract parts only (no questions) ───
  const extractParts = async (text: string) => {
    if (!apiKey) { speakEL("Please add your API key in settings first.", storyLang); setScreen("apisetup"); return; }
    setIsProcessing(true);
    try {
      const existingParts = parts.map(p=>`${p.type}: ${p.text}`).join(", ");

      const langNote = storyLang === "ar" ? " The child is speaking in Arabic. Write part descriptions in Arabic." : "";
      const raw = await callClaude(
        `You help an 8-year-old brainstorm stories. Extract characters, places, and events from what they said. The input comes from a child's voice transcription — it may have unclear words, odd phrasing, or choppy sentences. Do your best to interpret what they meant. Be thorough but concise.${langNote}

Return ONLY JSON: {"parts":[{"type":"character"|"place"|"event","text":"short description"}]}

Existing parts (don't repeat these): ${existingParts || "none yet"}`,
        `My story ideas: "${text}"`
      );
      const parsed = JSON.parse(raw);

      if (parsed.parts?.length) {
        const np: StoryPart[] = parsed.parts.map((p:any) => ({ id: Math.random().toString(36).slice(2,8), type: p.type, text: p.text }));
        setParts(prev => [...prev, ...np]);
        // No auto-speak — don't interrupt the child's flow
      }
    } catch {
      setParts(prev => [...prev, {id:Math.random().toString(36).slice(2,8), type:"event", text}]);
      // No auto-speak on brainstorm
    }
    setIsProcessing(false);
  };

  // ─── Ask Claude for help (on-demand questions) ───
  const askForHelp = async () => {
    if (!apiKey) { speakEL("Please add your API key in settings first.", storyLang); setScreen("apisetup"); return; }
    setIsProcessing(true);
    try {
      const allInput = rawInputs.join(". ");
      const existingParts = parts.map(p=>`${p.type}: ${p.text}`).join(", ");
      const answeredQs = questions.filter(q=>q.answered).map(q=>`Q: ${q.question} A: ${q.answer}`).join("; ");

      const langNote = storyLang === "ar" ? " The child is telling their story in Arabic. Ask questions in Arabic." : "";
      const raw = await callClaude(
        `You are a gentle collaborator helping a child develop THEIR story. Ask 2-3 fun follow-up questions about what they already mentioned — help them add more detail to their own ideas.

IMPORTANT: Only ask about characters, places, and events the child has already introduced. Do NOT suggest new characters or plot directions. Your questions should help them describe and expand what they've already imagined.

Good questions: "What color is [character they mentioned]?", "What does [their place] look like?", "What happened next after [their event]?", "How did [their character] feel?"
Bad questions: "Maybe there could be a villain?", "What if a fairy appears?" (introducing new ideas they didn't mention)

Don't repeat questions already asked.${langNote}

Return ONLY JSON: {"questions":["question 1","question 2","question 3"]}

Previously asked: ${answeredQs || "none yet"}
The child's story so far: ${allInput || "nothing yet"}`,
        `Help me with my story!`
      );
      const parsed = JSON.parse(raw);

      if (parsed.questions?.length) {
        const newQs: ClaudeQuestion[] = parsed.questions.map((q:string) => ({
          id: Math.random().toString(36).slice(2,8), question: q, answered: false,
        }));
        setQuestions(prev => [...prev, ...newQs]);
        // Don't auto-speak — brainstorm page stays silent. User can tap speaker icon to hear.
      }
    } catch {
      console.error("Failed to generate questions");
    }
    setIsProcessing(false);
  };

  // ─── Answer a Claude question via voice ───
  const [questionListenStatus, setQuestionListenStatus] = useState("");

  const startAnswering = (qId: string) => {
    if (!openaiKey) { speakEL("Please add your OpenAI key in settings first.", storyLang); return; }

    // Stop any TTS first
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);

    setAnsweringQuestion(qId);
    setQuestionTranscript("");
    setQuestionListenStatus("🎙️ Recording... tap Done when finished");

    questionAudioChunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      questionMediaRecRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) questionAudioChunksRef.current.push(e.data);
      };

      recorder.start(500);
    }).catch(err => {
      console.error("Mic access error:", err);
      setQuestionListenStatus("Microphone blocked — ask a grown-up");
      setAnsweringQuestion(null);
    });
  };

  const stopAnswering = async () => {
    const recorder = questionMediaRecRef.current;
    questionMediaRecRef.current = null;

    if (!recorder || recorder.state === "inactive") {
      setQuestionListenStatus("");
      setAnsweringQuestion(null);
      return;
    }

    setQuestionListenStatus("Transcribing...");

    await new Promise<void>(resolve => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    recorder.stream.getTracks().forEach(t => t.stop());

    const audioBlob = new Blob(questionAudioChunksRef.current, { type: recorder.mimeType });
    questionAudioChunksRef.current = [];

    if (audioBlob.size < 1000) {
      setQuestionListenStatus("");
      setAnsweringQuestion(null);
      return;
    }

    try {
      const text = await transcribeWithWhisper(audioBlob, storyLang);
      setQuestionListenStatus("");
      const answer = text.trim();
      if (answer && answeringQuestion) {
        setQuestions(prev => prev.map(q => q.id === answeringQuestion ? {...q, answered: true, answer} : q));
        setRawInputs(prev => [...prev, answer]);
        extractParts(answer);
      }
    } catch (err) {
      console.error("Whisper transcription failed:", err);
      setQuestionListenStatus("Transcription failed");
    }
    setAnsweringQuestion(null);
    setQuestionTranscript("");
  };

  const skipQuestion = (qId: string) => {
    setQuestions(prev => prev.map(q => q.id === qId ? {...q, answered: true, answer: "(skipped)"} : q));
  };

  // ─── Write story (includes question answers) ───
  const writeStory = async () => {
    if (!apiKey) { speakEL("Please add your API key in settings first.", storyLang); setScreen("apisetup"); return; }
    setIsProcessing(true); setScreen("story");
    // Don't auto-speak — let the story reading handle audio
    try {
      const allInput = rawInputs.join(". ");
      const pd = parts.map(p=>`${p.type}: ${p.text}`).join(", ");
      const qa = questions.filter(q=>q.answered&&q.answer!=="(skipped)").map(q=>`Q: ${q.question} A: ${q.answer}`).join(". ");

      const langInstr = storyLang === "ar"
        ? 'Write the story entirely in Arabic (Modern Standard Arabic suitable for children). Use simple, vivid Arabic. The title must also be in Arabic.'
        : 'Write in English. Simple vivid language.';
      const raw = await callClaude(
        `You transcribe a child's story. You are a TRANSCRIBER, not a writer. Output must be almost identical to input — just with clean grammar and sentence flow.

STRICT RULES — VIOLATION = FAILURE:
1. WORD COUNT: Your output should be roughly the same length as their input. If they said 30 words, output ~30 words. NEVER double or triple the length.
2. ZERO ADDITIONS: Do not add ANY word, phrase, character, event, place, emotion, adjective, dialogue, action, or detail that the child did not explicitly say. Nothing. Not even "one day" or "the end."
3. NO EMBELLISHMENT: "a dog walked" stays "a dog walked." Do NOT write "a happy dog walked through the sunny park." Every added word is a violation.
4. NO ENDING/MORAL: Do not add conclusions, morals, or wrap-up sentences unless the child said them.
5. KEEP WEIRD STUFF: If the child said something illogical, keep it exactly.
6. SIMPLE VOCABULARY: Use only the child's own words and vocabulary level. Do not upgrade language.
7. Your ONLY allowed changes: fix grammar errors, connect choppy phrases with "and/then/so", split into pages.

${langInstr} Break into pages of 1-2 sentences each. Short input = fewer pages. Return ONLY JSON: {"title":"...","pages":["page1","page2",...]}`,
        `The child said: "${allInput}". Additional details from questions: ${qa || "none"}`,
        2000
      );
      const parsed = JSON.parse(raw);
      setStoryTitle(parsed.title || (storyLang==="ar"?"قصتي":"My story"));
      const pgs = (parsed.pages||[]).map((t:string)=>({text:t}));
      setPages(pgs); setPageIdx(0);
      // Don't auto-read — let the child read at their own pace
    } catch { speakEL("Something went wrong. Let's try again.", storyLang); }
    setIsProcessing(false);
  };

  // Read with karaoke (uses ElevenLabs if available)
  const readChainKaraoke = (pgs:{text:string}[], idx:number, lang: StoryLang = storyLang) => {
    if (idx >= pgs.length) { return; }
    setPageIdx(idx);
    speakEL(pgs[idx].text, lang, () => readChainKaraoke(pgs, idx+1, lang));
  };

  // ─── Gemini image generation ───
  // Compress image: resize to max 768px and convert to JPEG ~80% quality (~100-200KB)
  const compressImage = (dataUrl: string, maxSize = 768): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > h && w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; }
        else if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => resolve(dataUrl); // fallback to original
      img.src = dataUrl;
    });
  };

  const generateOneImage = async (prompt: string): Promise<string> => {
    if (!geminiKey) throw new Error("no-gemini-key");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT","IMAGE"] },
      }),
    });
    if (!res.ok) { const err = await res.text(); console.error("Gemini error", res.status, err); throw new Error("Gemini API error: " + res.status); }
    const data = await res.json();
    // Find inline image data in response
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        const rawUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        // Compress to ~100-200KB JPEG
        return await compressImage(rawUrl);
      }
    }
    throw new Error("No image in response");
  };

  const extractCharacterDescription = async () => {
    const allText = pages.map(p=>p.text).join(" ");
    try {
      const desc = await callClaude(
        `Extract a detailed visual character description from this children's story for an illustrator. For EACH character mentioned, describe: name, gender, approximate age, hair color/style, skin tone, eye color, clothing, and any distinctive features. Be specific and consistent. Keep under 100 words total. Return ONLY the description text, no JSON.`,
        allText,
        300
      );
      setCharacterDesc(desc);
      return desc;
    } catch { return ""; }
  };

  // Build a consistency prompt that's shared across all images
  const buildImagePrompt = (chosenStyle: typeof STYLES[0], charDesc: string, sceneText: string) => {
    return `IMPORTANT: You must follow this exact art style consistently: ${chosenStyle.prompt}.
${charDesc ? `CHARACTERS (draw them EXACTLY like this every time): ${charDesc}.` : ""}
Scene to illustrate: ${sceneText}.
Rules: Children's book illustration. No text, words, or letters anywhere in the image. Safe for children. Keep the exact same art style, colors, and character appearances as described above.`;
  };

  const generateImages = async (style?: string) => {
    const chosenStyle = STYLES.find(s=>s.id===(style||storyStyle)) || STYLES[0];
    setScreen("pictures"); setIsProcessing(true);

    // Get detailed character description for consistency across all images
    let charDesc = characterDesc;
    if (!charDesc) { charDesc = await extractCharacterDescription(); }

    // Generate cover image first
    setGeneratingIdx(-1);
    try {
      const coverPrompt = buildImagePrompt(chosenStyle, charDesc,
        `Book cover for a children's story called "${storyTitle}". Show the main character(s) in a beautiful, inviting scene. This is the COVER — make it eye-catching and magical.`);
      const coverImg = await generateOneImage(coverPrompt);
      setCoverImageUrl(coverImg);
    } catch (err) { console.error("Failed to generate cover:", err); }

    // Generate each page image
    for (let i = 0; i < pages.length; i++) {
      setGeneratingIdx(i);
      try {
        const imgUrl = await generateOneImage(buildImagePrompt(chosenStyle, charDesc, pages[i].text));
        setPages(prev => prev.map((p, j) => j === i ? { ...p, imageUrl: imgUrl } : p));
      } catch (err) {
        console.error(`Failed to generate image ${i+1}:`, err);
      }
    }
    setGeneratingIdx(-1);
    setIsProcessing(false);
  };

  const redoImage = async (pageIndex: number, customPrompt: string) => {
    const chosenStyle = STYLES.find(s=>s.id===storyStyle) || STYLES[0];
    setGeneratingIdx(pageIndex);
    try {
      const imgUrl = await generateOneImage(buildImagePrompt(chosenStyle, characterDesc, customPrompt || pages[pageIndex].text));
      setPages(prev => prev.map((p, j) => j === pageIndex ? { ...p, imageUrl: imgUrl } : p));
    } catch (err) { console.error("Failed to regenerate:", err); }
    setGeneratingIdx(-1);
    setRedoingPage(null);
    setRedoPrompt("");
  };

  const redoCover = async () => {
    const chosenStyle = STYLES.find(s=>s.id===storyStyle) || STYLES[0];
    setGeneratingIdx(-2); // -2 = cover generating
    try {
      const coverPrompt = buildImagePrompt(chosenStyle, characterDesc,
        `Book cover for a children's story called "${storyTitle}". Show the main character(s) in a beautiful, inviting scene. This is the COVER — make it eye-catching and magical.`);
      const coverImg = await generateOneImage(coverPrompt);
      setCoverImageUrl(coverImg);
    } catch (err) { console.error("Failed to regenerate cover:", err); }
    setGeneratingIdx(-1);
  };

  const saveStory = () => {
    const s:Story={id:Math.random().toString(36).slice(2,10),title:storyTitle,rawInput:rawInputs,parts,pages,createdAt:Date.now(),lang:storyLang,coverImageUrl,authorName};
    setStories(prev=>[s,...prev]);
    // No auto-speak on save — clear all state and go to library
    setRawInputs([]);setParts([]);setTranscript("");setPages([]);setStoryTitle("");setQuestions([]);
    setViewStory(null);setViewIdx(0);setEditingPageIdx(null);setCoverImageUrl("");setAuthorName("");setCharacterDesc("");
    setScreen("library");
  };

  const startNew=()=>{
    setRawInputs([]);setParts([]);setTranscript("");setPages([]);setStoryTitle("");setQuestions([]);setStoryLang("en");setEditingTranscript(null);setCoverImageUrl("");setAuthorName("");setCharacterDesc("");
    setScreen("brainstorm");
    // Don't auto-speak — it conflicts with mic input. Let the child start when ready.
  };

  // ─── Download story as PDF ───
  // Render text on a canvas (supports Arabic/RTL natively) and return as data URL
  const renderTextToImage = (text: string, opts: {
    fontSize?: number; color?: string; maxWidth: number;
    align?: "center"|"left"|"right"; isRTL?: boolean; bold?: boolean;
  }): string => {
    const { fontSize = 14, color = "#323232", maxWidth, align = "left", isRTL = false, bold = false } = opts;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const scale = 3;
    const font = `${bold ? "bold " : ""}${fontSize * scale}px ${isRTL ? "'Noto Sans Arabic', 'Arial', sans-serif" : "'Arial', sans-serif"}`;
    ctx.font = font;
    // Word-wrap
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxWidth * scale) { if (cur) lines.push(cur); cur = w; } else { cur = test; }
    }
    if (cur) lines.push(cur);
    const lh = fontSize * scale * 1.6;
    canvas.width = maxWidth * scale;
    canvas.height = lines.length * lh + fontSize * scale;
    ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = "top";
    if (isRTL) ctx.direction = "rtl";
    lines.forEach((line, i) => {
      const y = i * lh;
      const w = ctx.measureText(line).width;
      if (align === "center") ctx.fillText(line, (canvas.width - w) / 2, y);
      else if (align === "right" || isRTL) ctx.fillText(line, canvas.width - w, y);
      else ctx.fillText(line, 0, y);
    });
    return canvas.toDataURL("image/png");
  };

  const downloadPDF = async (title: string, storyPages: {text:string; imageUrl?:string}[], lang: "en"|"ar") => {
    const isRTL = lang === "ar";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentW = pageW - margin * 2;

    // Helper: add a rendered text image to PDF
    const addTextImage = (dataUrl: string, x: number, y: number, maxW: number, maxH: number) => {
      try {
        const img = new Image(); img.src = dataUrl;
        const ratio = img.naturalHeight / img.naturalWidth || 0.3;
        const h = Math.min(maxW * ratio, maxH);
        doc.addImage(dataUrl, "PNG", x, y, maxW, h);
        return h;
      } catch { return 0; }
    };

    // ── Cover page ──
    doc.setFillColor(237, 233, 254);
    doc.rect(0, 0, pageW, pageH, "F");
    let cy = margin;
    if (coverImageUrl) {
      try { const iw = contentW, ih = contentW * 0.75; doc.addImage(coverImageUrl, "JPEG", margin, cy, iw, ih); cy += ih + 10; } catch { /* skip */ }
    } else { cy = pageH * 0.35; }

    // Title (rendered as image for Arabic support)
    const titleImg = renderTextToImage(title, { fontSize: 26, color: "#4C1D95", maxWidth: contentW, align: "center", isRTL, bold: true });
    cy += addTextImage(titleImg, margin, cy, contentW, 40) + 5;

    // Author
    if (authorName) {
      const byLine = isRTL ? `بقلم: ${authorName}` : `By ${authorName}`;
      const authImg = renderTextToImage(byLine, { fontSize: 14, color: "#9D174D", maxWidth: contentW, align: "center", isRTL });
      addTextImage(authImg, margin, cy, contentW * 0.6, 20);
    }

    // ── Story pages ──
    for (let i = 0; i < storyPages.length; i++) {
      doc.addPage();
      const pg = storyPages[i];
      let py = margin;
      if (pg.imageUrl) {
        try { const iw = contentW, ih = contentW * 0.75; doc.addImage(pg.imageUrl, "JPEG", margin, py, iw, ih); py += ih + 8; } catch { py += 4; }
      }
      // Text as image (Arabic-safe)
      const txtImg = renderTextToImage(pg.text, { fontSize: 14, color: "#323232", maxWidth: contentW, align: isRTL ? "right" : "left", isRTL });
      addTextImage(txtImg, margin, py, contentW, pageH - py - 15);
      // Page number (ASCII — safe with default font)
      doc.setFontSize(10); doc.setTextColor(160, 160, 160);
      doc.text(`${i + 1}`, pageW / 2, pageH - 8, { align: "center" });
    }
    doc.save(`${title}.pdf`);
  };

  const pal=(i:number)=>PALETTES[i%PALETTES.length];
  const recommendedVoices=browserVoices.slice(0,5);
  const otherVoices=browserVoices.slice(5);
  const unansweredQuestions = questions.filter(q => !q.answered);

  // ─── API SETUP ───
  if (screen === "apisetup") {
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#DBEAFE"}}>
          <button className="icon-btn" onClick={()=>{setScreen(prevScreen);}} style={{color:"#1E3A5F"}}><Back/></button>
          <div className="topbar-title" style={{color:"#1E3A5F"}}>Setup</div>
        </div>
        <div className="body" style={{padding:24}}>
          {/* Claude API Key */}
          <div style={{marginBottom:32}}>
            <h3 style={{fontSize:18,fontWeight:600,color:"#1E3A5F",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Sparkle s={20}/> Claude AI (required)</h3>
            <p style={{fontSize:13,color:"#64748B",marginBottom:14}}>Creates stories from your ideas. Get a key at console.anthropic.com</p>
            <input type="password" placeholder="Paste Claude key (sk-ant-...)" value={apiKeyInput || apiKey} onChange={e=>setApiKeyInput(e.target.value)}
              style={{width:"100%",padding:"14px 16px",borderRadius:14,border:`2px solid ${apiKey?"#86EFAC":"#BFDBFE"}`,background:apiKey?"#F0FDF4":"#F0F9FF",fontFamily:"var(--font)",fontSize:15,color:"#1E3A5F",outline:"none"}}
            />
            <button onClick={()=>{
              const key=(apiKeyInput||apiKey).trim();
              if(key.startsWith("sk-")){saveApiKey(key);setApiKeyInput("");}
              else{/* invalid key, no speech */}
            }} style={{width:"100%",marginTop:10,padding:"14px",borderRadius:14,border:"none",background:"#2563EB",color:"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer"}}>
              {apiKey?"Update":"Save"}
            </button>
            {apiKey && <div style={{marginTop:10,padding:"10px 14px",background:"#D1FAE5",borderRadius:12,display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#064E3B",fontWeight:500}}><Check/> Connected</div>}
          </div>

          {/* ElevenLabs API Key */}
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:18,fontWeight:600,color:"#7C2D12",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Speaker s={20}/> ElevenLabs Voices (optional)</h3>
            <p style={{fontSize:13,color:"#64748B",marginBottom:14}}>Premium voices for storytelling. Supports English + Arabic. Get a key at elevenlabs.io</p>
            <input type="password" placeholder="Paste ElevenLabs key" value={elKeyInput || elKey} onChange={e=>setElKeyInput(e.target.value)}
              style={{width:"100%",padding:"14px 16px",borderRadius:14,border:`2px solid ${elKey?"#86EFAC":"#FDBA74"}`,background:elKey?"#F0FDF4":"#FFF7ED",fontFamily:"var(--font)",fontSize:15,color:"#7C2D12",outline:"none"}}
            />
            <button onClick={()=>{
              const key=(elKeyInput||elKey).trim();
              if(key.length>10){saveElKey(key);setElKeyInput("");}
              else{/* invalid key, no speech */}
            }} style={{width:"100%",marginTop:10,padding:"14px",borderRadius:14,border:"none",background:"#EA580C",color:"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer"}}>
              {elKey?"Update":"Save"}
            </button>
            {elKey && <div style={{marginTop:10,padding:"10px 14px",background:"#D1FAE5",borderRadius:12,display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#064E3B",fontWeight:500}}><Check/> Connected</div>}
            {!elKey && <p style={{fontSize:12,color:"#94A3B8",marginTop:8}}>Without this, stories will use your device's built-in voice.</p>}
          </div>

          {/* OpenAI Whisper Key */}
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:18,fontWeight:600,color:"#059669",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Mic s={20}/> OpenAI Whisper (required for voice)</h3>
            <p style={{fontSize:13,color:"#64748B",marginBottom:14}}>High-quality voice transcription — great with kids. Get a key at platform.openai.com</p>
            <input type="password" placeholder="Paste OpenAI key (sk-...)" value={openaiKeyInput || openaiKey} onChange={e=>setOpenaiKeyInput(e.target.value)}
              style={{width:"100%",padding:"14px 16px",borderRadius:14,border:`2px solid ${openaiKey?"#86EFAC":"#A7F3D0"}`,background:openaiKey?"#F0FDF4":"#ECFDF5",fontFamily:"var(--font)",fontSize:15,color:"#064E3B",outline:"none"}}
            />
            <button onClick={()=>{
              const key=(openaiKeyInput||openaiKey).trim();
              if(key.length>10){saveOpenaiKey(key);setOpenaiKeyInput("");}
            }} style={{width:"100%",marginTop:10,padding:"14px",borderRadius:14,border:"none",background:"#059669",color:"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer"}}>
              {openaiKey?"Update":"Save"}
            </button>
            {openaiKey && <div style={{marginTop:10,padding:"10px 14px",background:"#D1FAE5",borderRadius:12,display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#064E3B",fontWeight:500}}><Check/> Connected</div>}
          </div>

          {/* Gemini API Key */}
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:18,fontWeight:600,color:"#831843",marginBottom:6,display:"flex",alignItems:"center",gap:8}}><Img s={20}/> Gemini Pictures (optional)</h3>
            <p style={{fontSize:13,color:"#64748B",marginBottom:14}}>AI-generated illustrations for your stories. Get a key at aistudio.google.com</p>
            <input type="password" placeholder="Paste Gemini key" value={geminiKeyInput || geminiKey} onChange={e=>setGeminiKeyInput(e.target.value)}
              style={{width:"100%",padding:"14px 16px",borderRadius:14,border:`2px solid ${geminiKey?"#86EFAC":"#FBCFE8"}`,background:geminiKey?"#F0FDF4":"#FDF2F8",fontFamily:"var(--font)",fontSize:15,color:"#831843",outline:"none"}}
            />
            <button onClick={()=>{
              const key=(geminiKeyInput||geminiKey).trim();
              if(key.length>10){saveGeminiKey(key);setGeminiKeyInput("");}
            }} style={{width:"100%",marginTop:10,padding:"14px",borderRadius:14,border:"none",background:"#DB2777",color:"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer"}}>
              {geminiKey?"Update":"Save"}
            </button>
            {geminiKey && <div style={{marginTop:10,padding:"10px 14px",background:"#D1FAE5",borderRadius:12,display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#064E3B",fontWeight:500}}><Check/> Connected</div>}
            {!geminiKey && <p style={{fontSize:12,color:"#94A3B8",marginTop:8}}>Without this, pictures will use simple placeholders.</p>}
          </div>

          <p style={{fontSize:12,color:"#94A3B8",textAlign:"center",lineHeight:1.5}}>
            Keys are stored only on this device and never shared.
          </p>
        </div>
      </div>
    );
  }

  // ─── SETTINGS ───
  if (screen === "settings") {
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#F5F3FF"}}>
          <button className="icon-btn" onClick={()=>{stopSpeaking();setScreen("library");}} style={{color:"#4C1D95"}}><Back/></button>
          <div className="topbar-title" style={{color:"#4C1D95"}}><Gear s={20}/> Voice settings</div>
          <button className="icon-btn" onClick={()=>speakEL("Pick a voice and adjust the speed!","en")} style={{color:"#7C3AED"}}><Speaker s={24}/></button>
        </div>
        <div className="body" style={{padding:20}}>
          <div className="settings-section">
            <div className="settings-label">Speed</div>
            <div className="speed-row"><span className="speed-icon">Slow</span><input type="range" min={0.4} max={0.9} step={0.05} value={voiceConfig.speed} className="speed-slider" onChange={e=>setVoiceConfig(v=>({...v,speed:parseFloat(e.target.value)}))}/><span className="speed-icon">Fast</span></div>
            <div className="speed-value">{voiceConfig.speed.toFixed(2)}x</div>
          </div>
          <div className="settings-section">
            <div className="settings-label">Pitch</div>
            <div className="speed-row"><span className="speed-icon">Low</span><input type="range" min={0.7} max={1.4} step={0.05} value={voiceConfig.pitch} className="speed-slider" onChange={e=>setVoiceConfig(v=>({...v,pitch:parseFloat(e.target.value)}))}/><span className="speed-icon">High</span></div>
            <div className="speed-value">{voiceConfig.pitch.toFixed(2)}</div>
          </div>
          <div className="settings-section">
            <div className="settings-label"><StarSmall/> Device voices</div>
            <div className="voice-list">
              {browserVoices.filter(v => {
                const n = v.name.toLowerCase();
                return (n.includes("google") && !n.includes("compact"));
              }).map(v=>{const sel=voiceConfig.voiceURI===v.voiceURI;const tst=testingVoice===v.voiceURI;const tag=getVoiceTag(v);return(
                <button key={v.voiceURI} className={`voice-option ${sel?"selected":""}`} onClick={()=>setVoiceConfig(vc=>({...vc,voiceURI:v.voiceURI,voiceName:v.name}))}>
                  <div className="voice-option-info"><div className="voice-name-row"><span className="voice-name">{cleanVoiceName(v.name)}</span>{tag&&<span className="voice-tag">{tag}</span>}</div><span className="voice-lang">{v.lang}</span></div>
                  <div className="voice-option-actions"><button className="try-btn" onClick={e=>{e.stopPropagation();tst?stopSpeaking():testVoice(v);}}>{tst?<Stop/>:<Play/>}</button>{sel&&<div className="check-mark"><Check/></div>}</div>
                </button>);})}
            </div>
          </div>
          {/* ElevenLabs voices */}
          {elKey && (
            <div className="settings-section">
              <div className="settings-label"><Speaker s={14}/> ElevenLabs Story Voices</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <button className="voice-option" style={{flex:1,borderColor:"#2563EB",background:"#EFF6FF"}} onClick={()=>testingEL?stopSpeaking():testELVoice("en")}>
                  <div className="voice-option-info"><span className="voice-name">English voice</span><span className="voice-lang">For English stories</span></div>
                  <div className="voice-option-actions"><button className="try-btn" onClick={e=>{e.stopPropagation();testingEL?stopSpeaking():testELVoice("en");}}>{testingEL?<Stop/>:<Play/>}</button></div>
                </button>
              </div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <button className="voice-option" style={{flex:1,borderColor:"#EA580C",background:"#FFF7ED"}} onClick={()=>testingEL?stopSpeaking():testELVoice("ar")}>
                  <div className="voice-option-info"><span className="voice-name">صوت عربي</span><span className="voice-lang">For Arabic stories</span></div>
                  <div className="voice-option-actions"><button className="try-btn" onClick={e=>{e.stopPropagation();testingEL?stopSpeaking():testELVoice("ar");}}>{testingEL?<Stop/>:<Play/>}</button></div>
                </button>
              </div>
              <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Custom voice IDs can be set in the setup screen</div>
            </div>
          )}

          <div className="settings-section">
            <div className="settings-label">API Keys</div>
            <button className="voice-option" style={{borderColor:apiKey?"#059669":"#FDBA74",background:apiKey?"#F0FDF4":"#FFF7ED",marginBottom:8}} onClick={()=>{setPrevScreen("settings");setScreen("apisetup");}}>
              <div className="voice-option-info"><span className="voice-name">{apiKey?"Claude AI connected":"Set up Claude AI"}</span><span className="voice-lang">{apiKey?"Tap to change":"Required for stories"}</span></div>
              <div className="voice-option-actions">{apiKey?<div style={{color:"#059669"}}><Check/></div>:<ChevR/>}</div>
            </button>
            <button className="voice-option" style={{borderColor:elKey?"#059669":"#FDBA74",background:elKey?"#F0FDF4":"#FFF7ED",marginBottom:8}} onClick={()=>{setPrevScreen("settings");setScreen("apisetup");}}>
              <div className="voice-option-info"><span className="voice-name">{elKey?"ElevenLabs connected":"Set up ElevenLabs"}</span><span className="voice-lang">{elKey?"Premium voices active":"Optional — better voices"}</span></div>
              <div className="voice-option-actions">{elKey?<div style={{color:"#059669"}}><Check/></div>:<ChevR/>}</div>
            </button>
            <button className="voice-option" style={{borderColor:openaiKey?"#059669":"#FDBA74",background:openaiKey?"#F0FDF4":"#FFF7ED",marginBottom:8}} onClick={()=>{setPrevScreen("settings");setScreen("apisetup");}}>
              <div className="voice-option-info"><span className="voice-name">{openaiKey?"OpenAI Whisper connected":"Set up OpenAI Whisper"}</span><span className="voice-lang">{openaiKey?"Voice transcription active":"Required for voice input"}</span></div>
              <div className="voice-option-actions">{openaiKey?<div style={{color:"#059669"}}><Check/></div>:<ChevR/>}</div>
            </button>
            <button className="voice-option" style={{borderColor:geminiKey?"#059669":"#FDBA74",background:geminiKey?"#F0FDF4":"#FFF7ED"}} onClick={()=>{setPrevScreen("settings");setScreen("apisetup");}}>
              <div className="voice-option-info"><span className="voice-name">{geminiKey?"Gemini connected":"Set up Gemini"}</span><span className="voice-lang">{geminiKey?"AI illustrations active":"Optional — story pictures"}</span></div>
              <div className="voice-option-actions">{geminiKey?<div style={{color:"#059669"}}><Check/></div>:<ChevR/>}</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Book viewer with karaoke ───
  if (viewStory) {
    const si=stories.findIndex(s=>s.id===viewStory.id);const pi=pal(si>=0?si:0);const pg=viewStory.pages[viewIdx];const vLang=viewStory.lang||"en";const vRTL=vLang==="ar";
    return (
      <div className="shell">
        <div className="topbar" style={{background:pi.bg}}>
          <button className="icon-btn" onClick={()=>{stopSpeaking();setAutoListen(false);setViewStory(null);}} style={{color:pi.text}}><Back/></button>
          <div className="topbar-title" style={{color:pi.text}}>{viewStory.title}</div>
          <button className="icon-btn" onClick={()=>{if(isSpeaking){stopSpeaking();setAutoListen(false);}else{setAutoListen(true);speakEL(pg?.text||"",vLang);}}} style={{color:pi.accent}}>{isSpeaking?<Stop/>:<Speaker s={24}/>}</button>
        </div>
        <div className="body center-col" style={vRTL?{direction:"rtl"}:undefined}>
          {pg?.imageUrl&&<div className="page-img"><img src={pg.imageUrl} alt=""/></div>}
          {autoListen ? (
            <KaraokeText text={pg?.text||""} isReading={isKaraokeActive} currentWordIndex={currentWordIdx} accentColor={pi.accent}/>
          ) : (
            <div className="page-text" style={{fontSize:20,lineHeight:2,textAlign:"center",padding:"20px 8px",maxWidth:420,color:"#1C1917",fontFamily:"var(--font)"}}>{pg?.text||""}</div>
          )}
          <div className="page-num" style={{color:pi.accent,direction:"ltr"}}>{viewIdx+1} / {viewStory.pages.length}</div>
        </div>
        <div className="bottom-bar">
          <button className="big-btn" disabled={viewIdx===0} onClick={()=>{stopSpeaking();setViewIdx(i=>i-1);}} style={{background:pi.light,color:pi.text}}><ChevL/> {vRTL?"رجوع":"Back"}</button>
          <button className="big-btn" onClick={()=>{if(autoListen){stopSpeaking();setAutoListen(false);}else{setAutoListen(true);speakEL(pg?.text||"",vLang);}}} style={{background:autoListen?pi.accent:pi.bg,color:autoListen?"#fff":pi.text}}>{autoListen?<><Stop/> {vRTL?"إيقاف الصوت":"Sound off"}</>:<><Speaker s={22}/> {vRTL?"تشغيل الصوت":"Sound on"}</>}</button>
          <button className="big-btn" onClick={()=>downloadPDF(viewStory.title,viewStory.pages,viewStory.lang||"en")} style={{background:"#DBEAFE",color:"#1E3A5F"}}><DL s={20}/> PDF</button>
          <button className="big-btn" disabled={viewIdx===viewStory.pages.length-1} onClick={()=>{stopSpeaking();setViewIdx(i=>i+1);}} style={{background:pi.light,color:pi.text}}>{vRTL?"التالي":"Next"} <ChevR/></button>
        </div>
      </div>
    );
  }

  // ─── Library ───
  if (screen==="library") {
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#EDE9FE"}}><div className="topbar-title" style={{color:"#4C1D95"}}><Star/> My stories</div><button className="icon-btn" onClick={()=>{setPrevScreen("library");setScreen("settings");}} style={{color:"#7C3AED"}}><Gear/></button></div>
        <div className="body" style={{padding:20}}>
          {!apiKey && (
            <button onClick={()=>{setPrevScreen("library");setScreen("apisetup");}} style={{
              width:"100%",padding:"16px 20px",borderRadius:16,border:"2px solid #FDBA74",
              background:"#FFF7ED",cursor:"pointer",fontFamily:"var(--font)",
              display:"flex",alignItems:"center",gap:12,marginBottom:16,textAlign:"left",
            }}>
              <Sparkle s={24}/>
              <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:"#9A3412"}}>Set up Claude AI</div><div style={{fontSize:13,color:"#C2410C",marginTop:2}}>Add your API key to start creating stories</div></div>
              <ChevR/>
            </button>
          )}
          <button className="voice-indicator" onClick={()=>{setPrevScreen("library");setScreen("settings");}}><Speaker s={18}/><span>Voice: {cleanVoiceName(voiceConfig.voiceName||"Default")}</span><ChevR/></button>
          <div className="grid">
            <button className="card new-card" onClick={startNew}><Plus/><span>New story</span></button>
            {stories.map((s,i)=>{const p=pal(i);return(
              <button key={s.id} className="card story-card" style={{background:p.bg}} onClick={()=>{setAutoListen(false);setViewStory(s);setViewIdx(0);}}>
                <Book s={32}/><div className="card-title" style={{color:p.text}}>{s.title}</div><div className="card-sub" style={{color:p.accent}}>{s.pages.length} pages</div>
                <div className="card-btns"><span className="card-chip" style={{background:p.light,color:p.text}} onClick={e=>{e.stopPropagation();setAutoListen(false);setViewStory(s);setViewIdx(0);}}><Book s={16}/> Read</span><span className="card-chip" style={{background:p.light,color:p.text}} onClick={e=>{e.stopPropagation();setAutoListen(true);setViewStory(s);setViewIdx(0);}}><Speaker s={16}/> Listen</span></div>
              </button>);})}
          </div>
        </div>
      </div>
    );
  }

  // ─── Brainstorm with Claude questions ───
  if (screen==="brainstorm") {
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#D1FAE5"}}>
          <button className="icon-btn" onClick={()=>{stopSpeaking();if(isRecording)stopListening();setScreen("library");}} style={{color:"#064E3B"}}><Back/></button>
          <div className="topbar-title" style={{color:"#064E3B"}}>Tell your story</div>
          <button className="icon-btn" onClick={()=>{setPrevScreen("brainstorm");setScreen("settings");}} style={{color:"#059669"}}><Gear s={22}/></button>
        </div>
        <div className="body" style={{padding:20}}>
          {/* Language toggle */}
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <button onClick={()=>setStoryLang("en")} style={{
              flex:1,padding:"12px",borderRadius:14,border:`2px solid ${storyLang==="en"?"#059669":"#E7E5E4"}`,
              background:storyLang==="en"?"#D1FAE5":"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,
              color:storyLang==="en"?"#064E3B":"#78716C",cursor:"pointer",transition:"all 0.15s",
            }}>English</button>
            <button onClick={()=>setStoryLang("ar")} style={{
              flex:1,padding:"12px",borderRadius:14,border:`2px solid ${storyLang==="ar"?"#059669":"#E7E5E4"}`,
              background:storyLang==="ar"?"#D1FAE5":"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:600,
              color:storyLang==="ar"?"#064E3B":"#78716C",cursor:"pointer",transition:"all 0.15s",
            }}>العربية</button>
          </div>

          {/* Transcripts — show live words or editing */}
          {(isRecording||transcript||listenStatus||editingTranscript!==null)&&<div className="bubbles">
            {isRecording&&(
              <div className="bubble active" style={{
                ...(storyLang==="ar"?{direction:"rtl",textAlign:"right"}:{}),
                fontSize:transcript?18:15,
                lineHeight:1.6,
                color:transcript?"#064E3B":"#059669",
                minHeight:60,
              }}>
                {transcript ? (
                  <>{transcript}<span className="blink" style={{color:"#059669",fontWeight:700}}>|</span></>
                ) : (
                  <span>🎙️ Speak now — your words will appear here...</span>
                )}
              </div>
            )}
            {!isRecording&&listenStatus&&<div className="bubble active" style={{textAlign:"center",color:"#78716C",fontSize:15}}>{listenStatus}</div>}
            {editingTranscript!==null&&!isRecording&&(
              <div className="bubble active" style={{padding:0,border:"2px solid #059669",background:"#ECFDF5"}}>
                <textarea
                  ref={el=>{editRef.current=el;if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px";}}}
                  value={editingTranscript}
                  onChange={e=>{setEditingTranscript(e.target.value);const t=e.target;t.style.height="auto";t.style.height=t.scrollHeight+"px";}}
                  autoFocus
                  style={{
                    width:"100%",padding:"14px 18px",border:"none",background:"transparent",
                    fontFamily:"var(--font)",fontSize:17,lineHeight:1.55,color:"#064E3B",
                    resize:"none",minHeight:60,outline:"none",overflow:"hidden",
                    direction:storyLang==="ar"?"rtl":"ltr",textAlign:storyLang==="ar"?"right":"left",
                  }}
                />
                <div style={{display:"flex",gap:8,padding:"8px 14px 12px"}}>
                  <button onClick={()=>isSpeaking?stopSpeaking():speakEL(editingTranscript||"",storyLang)} style={{
                    padding:"12px 16px",borderRadius:12,border:"none",background:"#D1FAE5",color:"#064E3B",
                    fontFamily:"var(--font)",fontSize:15,fontWeight:500,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:6,
                  }}>{isSpeaking?<><Stop/> Stop</>:<><Speaker s={20}/> Listen</>}</button>
                  <button onClick={submitEditedTranscript} style={{
                    flex:1,padding:"12px",borderRadius:12,border:"none",background:"#059669",color:"#fff",
                    fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                  }}><Check/> Add to story</button>
                  <button onClick={discardTranscript} style={{
                    padding:"12px 16px",borderRadius:12,border:"none",background:"#F5F5F4",color:"#78716C",
                    fontFamily:"var(--font)",fontSize:15,fontWeight:500,cursor:"pointer",
                  }}>Discard</button>
                </div>
              </div>
            )}
          </div>}

          {/* Countdown */}
          {countdown!==null && (
            <div style={{textAlign:"center",padding:"24px 0"}}>
              <div style={{fontSize:56,fontWeight:700,color:"#059669",animation:"pulse 0.5s ease-in-out"}}>{countdown}</div>
            </div>
          )}

          {/* Listening status */}
          {isRecording && !countdown && <div className="listen-status">{listenStatus || "Listening..."}</div>}

          {/* Claude's questions */}
          {unansweredQuestions.length > 0 && !isRecording && (
            <div className="questions-section">
              {unansweredQuestions.map(q => (
                <div key={q.id} className="question-card">
                  <div className="question-header">
                    <Sparkle s={16}/>
                    <span>Claude asks:</span>
                    <button className="q-listen-btn" onClick={() => speakEL(q.question, storyLang)}><Speaker s={18}/></button>
                  </div>
                  <div className="question-text">{q.question}</div>
                  {answeringQuestion === q.id ? (
                    <div className="question-answering">
                      {questionListenStatus && <div className="listen-status" style={{color:"#C2410C",padding:"6px 0",margin:0,fontSize:14}}>{questionListenStatus}</div>}
                      {questionTranscript && <div className="q-transcript">{questionTranscript}<span className="blink">|</span></div>}
                      {!questionTranscript && !questionListenStatus && <div style={{color:"#C2410C",fontSize:14,padding:"8px 0"}}>Speak your answer...</div>}
                      <button className="q-action-btn recording" onClick={stopAnswering}><Stop/> Done</button>
                    </div>
                  ) : (
                    <div className="question-actions">
                      <button className="q-action-btn answer" onClick={() => startAnswering(q.id)}><Mic s={20}/> Answer</button>
                      <button className="q-action-btn skip" onClick={() => skipQuestion(q.id)}>Skip</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Answered questions */}
          {questions.filter(q=>q.answered && q.answer !== "(skipped)").length > 0 && (
            <div className="answered-section">
              {questions.filter(q=>q.answered && q.answer !== "(skipped)").map(q => (
                <div key={q.id} className="answered-card">
                  <div className="answered-q">{q.question}</div>
                  <div className="answered-a">{q.answer}</div>
                </div>
              ))}
            </div>
          )}


          {/* Submitted story parts */}
          {rawInputs.length>0&&(
            <div style={{marginTop:8}}>
              <div className="parts-heading">Your story so far</div>
              {rawInputs.map((r,i)=>(
                <div key={i} className="bubble" style={{
                  background:"#F0FDF4",border:"1px solid #BBF7D0",position:"relative",
                  direction:storyLang==="ar"?"rtl":"ltr",textAlign:storyLang==="ar"?"right":"left",
                  paddingRight:40,
                }}>
                  {r}
                  <button onClick={()=>setRawInputs(prev=>prev.filter((_,j)=>j!==i))} style={{
                    position:"absolute",top:10,right:10,background:"none",border:"none",
                    color:"#78716C",cursor:"pointer",opacity:0.5,padding:4,
                  }} aria-label="Remove">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {!transcript&&!isRecording&&rawInputs.length===0&&editingTranscript===null&&questions.length===0&&(
            <div className="empty"><div style={{color:"#059669",marginBottom:16}}><Mic s={56}/></div><p className="empty-main">Tap the microphone!</p><p className="empty-sub">Tell me about your story</p></div>
          )}
        </div>
        <div className="bottom-bar" style={{flexWrap:"wrap"}}>
          <button className={`big-btn ${isRecording?"recording":""}`} onClick={isRecording?stopListening:startListening} style={{background:isRecording?"#FEE2E2":"#FEF3C7",color:isRecording?"#7F1D1D":"#78350F",flex:"1 1 45%"}}>{isRecording?<><Stop/> Stop</>:<><Mic/> Speak</>}</button>
          <button className="big-btn" disabled={isProcessing||rawInputs.length===0} onClick={askForHelp} style={{background:"#FFF7ED",color:"#9A3412",flex:"1 1 45%",opacity:isProcessing||rawInputs.length===0?0.35:1}}><Sparkle s={22}/> Help me</button>
          <button className="big-btn" disabled={rawInputs.length===0} onClick={()=>{if(isRecording)stopListening();writeStory();}} style={{background:"#EDE9FE",color:"#4C1D95",flex:"1 1 100%",opacity:rawInputs.length===0?0.35:1}}><ChevR/> {storyLang==="ar"?"التالي":"Next"}</button>
        </div>
      </div>
    );
  }

  // ─── Style Picker (overlay — must be before story screen so it takes priority) ───
  if (showStylePicker) {
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#FCE7F3"}}>
          <button className="icon-btn" onClick={()=>setShowStylePicker(false)} style={{color:"#831843"}}><Back/></button>
          <div className="topbar-title" style={{color:"#831843"}}>Pick a style</div>
        </div>
        <div className="body" style={{padding:20}}>
          <p style={{fontSize:15,color:"#78716C",textAlign:"center",marginBottom:20}}>How should your pictures look?</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:14}}>
            {STYLES.map(s=>(
              <button key={s.id} onClick={()=>{setStoryStyle(s.id);setShowStylePicker(false);generateImages(s.id);}} style={{
                padding:"24px 16px",borderRadius:20,border:`3px solid ${storyStyle===s.id?"#DB2777":"transparent"}`,
                background:s.bg,cursor:"pointer",textAlign:"center",fontFamily:"var(--font)",
                transition:"transform 0.12s",
              }}>
                <div style={{fontSize:36,marginBottom:8}}>{s.emoji}</div>
                <div style={{fontSize:16,fontWeight:600,color:"#1C1917"}}>{s.name}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Story with karaoke + per-page edit ───
  if (screen==="story") {
    const pg=pages[pageIdx]; const isRTL=storyLang==="ar";
    const isEditingThis = editingPageIdx === pageIdx;
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#EDE9FE"}}>
          <button className="icon-btn" onClick={()=>{stopSpeaking();setEditingPageIdx(null);setScreen("brainstorm");}} style={{color:"#4C1D95"}}><Back/></button>
          <div className="topbar-title" style={{color:"#4C1D95"}}>{storyTitle||"Your story"}</div>
          <button className="icon-btn" onClick={()=>pg&&(isSpeaking?stopSpeaking():speakEL(pg.text,storyLang))} style={{color:"#7C3AED"}}>{isSpeaking?<Stop/>:<Speaker s={24}/>}</button>
        </div>
        <div className="body center-col" style={isRTL?{direction:"rtl"}:undefined}>
          {isProcessing?(
            <div className="empty"><div className="loader large"><div className="dot"/><div className="dot d2"/><div className="dot d3"/></div><p className="empty-main">{isRTL?"جاري كتابة قصتك...":"Writing your story..."}</p></div>
          ):pages.length>0&&(
            <>
              {isEditingThis ? (
                /* Edit mode for this page */
                <div style={{width:"100%",maxWidth:600,padding:"0 16px"}}>
                  <textarea
                    value={editingPageText}
                    onChange={e=>setEditingPageText(e.target.value)}
                    autoFocus
                    style={{
                      width:"100%",padding:"16px 18px",borderRadius:16,border:"2px solid #7C3AED",
                      background:"#F5F3FF",fontFamily:"var(--font)",fontSize:18,lineHeight:1.6,
                      color:"#4C1D95",resize:"none",minHeight:120,outline:"none",
                      direction:isRTL?"rtl":"ltr",textAlign:isRTL?"right":"left",
                    }}
                    ref={el=>{if(el){el.style.height="auto";el.style.height=Math.max(120,el.scrollHeight)+"px";}}}
                  />
                  <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"center"}}>
                    <button onClick={()=>{
                      setPages(prev=>prev.map((p,j)=>j===pageIdx?{...p,text:editingPageText}:p));
                      setEditingPageIdx(null);
                    }} style={{
                      padding:"12px 20px",borderRadius:12,border:"none",background:"#7C3AED",color:"#fff",
                      fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer",
                      display:"flex",alignItems:"center",gap:6,
                    }}><Check/> {isRTL?"حفظ":"Save"}</button>
                    <button onClick={()=>speakEL(editingPageText,storyLang)} style={{
                      padding:"12px 16px",borderRadius:12,border:"none",background:"#EDE9FE",color:"#4C1D95",
                      fontFamily:"var(--font)",fontSize:15,fontWeight:500,cursor:"pointer",
                      display:"flex",alignItems:"center",gap:6,
                    }}><Speaker s={20}/> {isRTL?"استمع":"Listen"}</button>
                    <button onClick={()=>setEditingPageIdx(null)} style={{
                      padding:"12px 16px",borderRadius:12,border:"none",background:"#F5F5F4",color:"#78716C",
                      fontFamily:"var(--font)",fontSize:15,fontWeight:500,cursor:"pointer",
                    }}>{isRTL?"إلغاء":"Cancel"}</button>
                  </div>
                </div>
              ) : (
                /* Normal reading mode */
                <>
                  <KaraokeText text={pg?.text||""} isReading={isKaraokeActive} currentWordIndex={currentWordIdx} accentColor="#7C3AED"/>
                  <button onClick={()=>{stopSpeaking();setEditingPageIdx(pageIdx);setEditingPageText(pg?.text||"");}} style={{
                    margin:"12px auto 0",padding:"8px 16px",borderRadius:10,border:"1px solid #C4B5FD",
                    background:"#F5F3FF",color:"#7C3AED",fontFamily:"var(--font)",fontSize:13,fontWeight:500,
                    cursor:"pointer",display:"flex",alignItems:"center",gap:5,
                  }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {isRTL?"تعديل":"Edit this page"}
                  </button>
                </>
              )}
              <div className="page-num" style={{color:"#7C3AED",direction:"ltr"}}>{pageIdx+1} / {pages.length}</div>
            </>
          )}
        </div>
        <div className="bottom-bar" style={{flexWrap:"wrap",gap:8}}>
          <button className="big-btn" disabled={pageIdx===0||pages.length===0} onClick={()=>{stopSpeaking();setEditingPageIdx(null);setPageIdx(i=>i-1);}} style={{background:"#F5F3FF",color:"#4C1D95",flex:"1 1 28%"}}><ChevL/> {isRTL?"رجوع":"Back"}</button>
          <button className="big-btn" onClick={()=>pg&&(isSpeaking?stopSpeaking():speakEL(pg.text,storyLang))} disabled={pages.length===0} style={{background:"#EDE9FE",color:"#4C1D95",flex:"1 1 28%"}}>{isSpeaking?<><Stop/> {isRTL?"توقف":"Stop"}</>:<><Speaker s={22}/> {isRTL?"استمع":"Listen"}</>}</button>
          <button className="big-btn" disabled={pageIdx>=pages.length-1||pages.length===0} onClick={()=>{stopSpeaking();setEditingPageIdx(null);setPageIdx(i=>i+1);}} style={{background:"#F5F3FF",color:"#4C1D95",flex:"1 1 28%"}}>{isRTL?"التالي":"Next"} <ChevR/></button>
          <button className="big-btn" onClick={()=>{setEditingPageIdx(null);setShowStylePicker(true);}} disabled={pages.length===0} style={{background:"#FCE7F3",color:"#831843",flex:"1 1 100%"}}><Img/> {isRTL?"أضف صور وغلاف":"Add cover & pictures"}</button>
        </div>
      </div>
    );
  }

  // ─── Pictures ───
  if (screen==="pictures") {
    const isRTL = storyLang === "ar";
    return (
      <div className="shell">
        <div className="topbar" style={{background:"#FCE7F3"}}>
          <button className="icon-btn" onClick={()=>{stopSpeaking();setScreen("story");setGeneratingIdx(-1);}} style={{color:"#831843"}}><Back/></button>
          <div className="topbar-title" style={{color:"#831843"}}>Pictures</div>
        </div>
        <div className="body" style={{padding:20}}>
          {/* Progress during generation */}
          {isProcessing && (
            <div style={{textAlign:"center",padding:"20px 0",marginBottom:16}}>
              <div className="loader large"><div className="dot"/><div className="dot d2"/><div className="dot d3"/></div>
              <p style={{fontSize:16,fontWeight:500,color:"#831843",marginTop:8}}>
                {generatingIdx === -1 ? "Drawing cover..." : `Drawing picture ${generatingIdx+1} of ${pages.length}...`}
              </p>
            </div>
          )}

          {/* If no images generated yet, show generate button */}
          {!isProcessing && !coverImageUrl && pages.every(p=>!p.imageUrl) && (
            <div style={{textAlign:"center",padding:"20px 0",marginBottom:16}}>
              <p style={{fontSize:15,color:"#78716C",marginBottom:14}}>No pictures yet — pick a style to generate them!</p>
              <button onClick={()=>setShowStylePicker(true)} style={{
                padding:"14px 28px",borderRadius:16,border:"none",background:"#DB2777",color:"#fff",
                fontFamily:"var(--font)",fontSize:16,fontWeight:600,cursor:"pointer",
              }}><Img s={20}/> Generate pictures</button>
            </div>
          )}

          {/* ── Cover Section ── */}
          <div style={{marginBottom:24,padding:20,background:"#FDF2F8",borderRadius:20,border:"2px solid #FBCFE8"}}>
            <div style={{fontSize:13,fontWeight:700,color:"#831843",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>📖 Book Cover</div>

            {/* Cover image */}
            {coverImageUrl ? (
              <div style={{position:"relative",marginBottom:14}}>
                <img src={coverImageUrl} alt="Cover" style={{width:"100%",borderRadius:14,display:"block"}}/>
                {!isProcessing && (
                  <button onClick={redoCover} style={{
                    position:"absolute",top:10,right:10,background:"rgba(219,39,119,0.9)",border:"none",borderRadius:10,padding:"8px 12px",
                    fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer",fontFamily:"var(--font)",
                  }}>🔄 Redo cover</button>
                )}
              </div>
            ) : (
              <div style={{width:"100%",aspectRatio:"4/3",background:generatingIdx===-2?"#FDF2F8":"#F5F5F4",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#78716C",marginBottom:14,flexDirection:"column",gap:8}}>
                {generatingIdx===-2 ? (
                  <div className="loader"><div className="dot"/><div className="dot d2"/><div className="dot d3"/></div>
                ) : (
                  <>
                    <span>No cover yet</span>
                    {!isProcessing && (
                      <button onClick={redoCover} style={{
                        background:"#DB2777",border:"none",borderRadius:10,padding:"8px 14px",
                        fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer",fontFamily:"var(--font)",
                      }}>Generate cover</button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Editable title */}
            <input
              value={storyTitle}
              onChange={e=>setStoryTitle(e.target.value)}
              placeholder={isRTL ? "عنوان الكتاب..." : "Book title..."}
              style={{
                width:"100%",padding:"12px 16px",borderRadius:12,border:"2px solid #FBCFE8",
                background:"#fff",fontFamily:"var(--font)",fontSize:18,fontWeight:700,
                color:"#831843",outline:"none",textAlign:"center",
                direction:isRTL?"rtl":"ltr",marginBottom:10,
              }}
            />

            {/* Author name */}
            <input
              value={authorName}
              onChange={e=>setAuthorName(e.target.value)}
              placeholder={isRTL ? "✍️ اسم المؤلف..." : "✍️ Author name..."}
              style={{
                width:"100%",padding:"10px 16px",borderRadius:12,border:"2px solid #FBCFE8",
                background:"#fff",fontFamily:"var(--font)",fontSize:15,fontWeight:500,
                color:"#9D174D",outline:"none",textAlign:"center",
                direction:isRTL?"rtl":"ltr",
              }}
            />
          </div>

          {/* Image grid */}
          <div style={{fontSize:13,fontWeight:700,color:"#831843",textTransform:"uppercase",letterSpacing:1,marginBottom:12}}>📄 Story Pages</div>
          <div className="pic-grid">
            {pages.map((p,i)=>(
              <div key={i} className="pic-card" style={{position:"relative"}}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={`Page ${i+1}`} style={{width:"100%",display:"block"}}/>
                ) : (
                  <div style={{width:"100%",aspectRatio:"4/3",background:generatingIdx===i?"#FDF2F8":"#F5F5F4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#78716C",flexDirection:"column",gap:8}}>
                    {generatingIdx===i ? (
                      <div className="loader"><div className="dot"/><div className="dot d2"/><div className="dot d3"/></div>
                    ) : (
                      <>
                        <span>Not generated</span>
                        {!isProcessing && (
                          <button onClick={()=>{setRedoingPage(i);setRedoPrompt("");}} style={{
                            background:"#DB2777",border:"none",borderRadius:10,padding:"8px 14px",
                            fontSize:13,fontWeight:600,color:"#fff",cursor:"pointer",fontFamily:"var(--font)",
                          }}>Generate</button>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div style={{padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span className="pic-label" style={{padding:0}}>Page {i+1}</span>
                  {p.imageUrl && !isProcessing && (
                    <button onClick={()=>{setRedoingPage(i);setRedoPrompt("");}} style={{
                      background:"#FDF2F8",border:"none",borderRadius:8,padding:"6px 10px",
                      fontSize:12,fontWeight:500,color:"#DB2777",cursor:"pointer",fontFamily:"var(--font)",
                    }}>Redo</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Redo dialog */}
          {redoingPage !== null && (
            <div style={{marginTop:16,padding:"18px",background:"#FDF2F8",borderRadius:18,border:"2px solid #FBCFE8"}}>
              <div style={{fontSize:14,fontWeight:600,color:"#831843",marginBottom:8}}>Redo Page {redoingPage+1}</div>
              <p style={{fontSize:13,color:"#9D174D",marginBottom:10}}>What should this picture show?</p>
              <textarea
                value={redoPrompt}
                onChange={e=>setRedoPrompt(e.target.value)}
                placeholder={pages[redoingPage]?.text || "Describe the scene..."}
                autoFocus
                style={{
                  width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid #FBCFE8",
                  background:"#fff",fontFamily:"var(--font)",fontSize:15,color:"#831843",
                  resize:"none",minHeight:60,outline:"none",
                }}
              />
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button onClick={()=>redoImage(redoingPage, redoPrompt || pages[redoingPage]?.text || "")} style={{
                  flex:1,padding:"12px",borderRadius:12,border:"none",background:"#DB2777",color:"#fff",
                  fontFamily:"var(--font)",fontSize:15,fontWeight:600,cursor:"pointer",
                }}><Img s={18}/> Draw it</button>
                <button onClick={()=>{setRedoingPage(null);setRedoPrompt("");}} style={{
                  padding:"12px 16px",borderRadius:12,border:"none",background:"#F5F5F4",color:"#78716C",
                  fontFamily:"var(--font)",fontSize:14,cursor:"pointer",
                }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="bottom-bar" style={{flexWrap:"wrap",gap:8}}>
          <button className="big-btn" onClick={()=>setShowStylePicker(true)} disabled={isProcessing} style={{background:"#FCE7F3",color:"#831843",flex:"1 1 45%"}}><Img/> Change style</button>
          <button className="big-btn" onClick={()=>downloadPDF(storyTitle||"My Story",pages,storyLang)} disabled={isProcessing} style={{background:"#DBEAFE",color:"#1E3A5F",flex:"1 1 45%"}}><DL s={20}/> PDF</button>
          <button className="big-btn" onClick={saveStory} disabled={isProcessing} style={{background:"#D1FAE5",color:"#064E3B",flex:"1 1 100%"}}><Book/> Save book</button>
        </div>
      </div>
    );
  }

  // Fallback — if we somehow get here, reset to library
  if (screen !== "library") { setScreen("library"); }
  return <div className="shell"><div className="topbar" style={{background:"#EDE9FE"}}><div className="topbar-title" style={{color:"#4C1D95"}}>Loading...</div></div></div>;
}
