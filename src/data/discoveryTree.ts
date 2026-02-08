// ============================================================
// 3-Tier Progressive Disclosure Filter Tree
// Domains → Subfields → Ecosystem Tracking
// ============================================================

export interface EcosystemTarget {
  id: string;
  name: string;
  projects: string[]; // Specific products/projects to track
}

export interface Subfield {
  id: string;
  name: string;
  name_he: string;
  description: string;
  ecosystem?: EcosystemTarget[];
}

export interface Domain {
  id: string;
  name: string;
  name_he: string;
  icon: string; // emoji
  subfields: Subfield[];
}

export const DISCOVERY_TREE: Domain[] = [
  {
    id: "language",
    name: "Text & Language",
    name_he: "טקסט ושפה",
    icon: "💬",
    subfields: [
      {
        id: "text_generation",
        name: "Text Generation",
        name_he: "יצירת טקסט",
        description: "מודלי שפה, LLMs, Reasoning",
        ecosystem: [
          { id: "openai", name: "OpenAI", projects: ["GPT-5", "GPT-5.2", "o3", "ChatGPT"] },
          { id: "anthropic", name: "Anthropic", projects: ["Claude 4", "Claude Opus", "Claude Sonnet"] },
          { id: "google_llm", name: "Google DeepMind", projects: ["Gemini 3", "Gemini Ultra", "Bard"] },
          { id: "meta_llm", name: "Meta AI", projects: ["Llama 4", "Code Llama"] },
          { id: "mistral", name: "Mistral AI", projects: ["Mistral Large", "Codestral", "Le Chat"] },
          { id: "xai", name: "xAI", projects: ["Grok 3", "Grok Vision"] },
        ],
      },
      {
        id: "chatbots",
        name: "Chatbots & Assistants",
        name_he: "צ'אטבוטים ועוזרים",
        description: "ממשקי שיחה, עוזרים וירטואליים",
        ecosystem: [
          { id: "characterai", name: "Character.AI", projects: ["Character Platform"] },
          { id: "inflection", name: "Inflection AI", projects: ["Pi"] },
          { id: "perplexity", name: "Perplexity", projects: ["Perplexity Pro", "Perplexity Enterprise"] },
        ],
      },
      {
        id: "translation",
        name: "Translation & Localization",
        name_he: "תרגום ולוקליזציה",
        description: "תרגום AI, לוקליזציה חכמה",
      },
      {
        id: "semantic_search",
        name: "Search & RAG",
        name_he: "חיפוש ו-RAG",
        description: "חיפוש סמנטי, Retrieval Augmented Generation",
        ecosystem: [
          { id: "cohere", name: "Cohere", projects: ["Command R+", "Embed v4", "Rerank"] },
        ],
      },
    ],
  },
  {
    id: "visual",
    name: "Visual AI",
    name_he: "AI ויזואלי",
    icon: "🎨",
    subfields: [
      {
        id: "image_generation",
        name: "Image Generation",
        name_he: "יצירת תמונות",
        description: "יצירה, עריכה, הרחבה, סגנון",
        ecosystem: [
          { id: "midjourney", name: "Midjourney", projects: ["Midjourney v7", "Midjourney Editor"] },
          { id: "stability", name: "Stability AI", projects: ["Stable Diffusion 4", "SDXL", "Stable Video"] },
          { id: "ideogram", name: "Ideogram", projects: ["Ideogram 3"] },
          { id: "flux", name: "Black Forest Labs", projects: ["FLUX Pro", "FLUX 2"] },
        ],
      },
      {
        id: "video_generation",
        name: "Video Generation",
        name_he: "יצירת וידאו",
        description: "Text-to-Video, עריכת וידאו AI",
        ecosystem: [
          { id: "runway", name: "Runway", projects: ["Gen-4", "Gen-3 Alpha"] },
          { id: "sora", name: "OpenAI Sora", projects: ["Sora API", "Sora Turbo"] },
          { id: "pika", name: "Pika Labs", projects: ["Pika 2.0"] },
          { id: "kling", name: "Kuaishou", projects: ["Kling AI"] },
          { id: "veo", name: "Google Veo", projects: ["Veo 3"] },
        ],
      },
      {
        id: "3d_generation",
        name: "3D Generation",
        name_he: "יצירת 3D",
        description: "מודלים תלת-ממדיים, NeRF, Gaussian Splatting",
      },
      {
        id: "object_detection",
        name: "Computer Vision",
        name_he: "ראייה ממוחשבת",
        description: "זיהוי אובייקטים, סגמנטציה, מעקב",
      },
    ],
  },
  {
    id: "agents",
    name: "Agents & Automation",
    name_he: "סוכנים ואוטומציה",
    icon: "🤖",
    subfields: [
      {
        id: "ai_agents",
        name: "AI Agents",
        name_he: "סוכני AI",
        description: "סוכנים אוטונומיים, Agentic AI, MCP",
        ecosystem: [
          { id: "adept", name: "Adept AI", projects: ["ACT-2"] },
          { id: "devin", name: "Cognition", projects: ["Devin 2"] },
          { id: "manus", name: "Manus AI", projects: ["Manus Agent"] },
          { id: "openai_agents", name: "OpenAI Agents", projects: ["Operator", "Computer Use"] },
          { id: "anthropic_agents", name: "Anthropic Agents", projects: ["Claude Computer Use", "Claude MCP"] },
        ],
      },
      {
        id: "rpa",
        name: "Process Automation",
        name_he: "אוטומציית תהליכים",
        description: "RPA חכם, Intelligent Automation",
      },
      {
        id: "robotics",
        name: "Robotics",
        name_he: "רובוטיקה",
        description: "רובוטים אוטונומיים, Humanoids",
        ecosystem: [
          { id: "figure", name: "Figure AI", projects: ["Figure 02"] },
          { id: "tesla_bot", name: "Tesla Bot", projects: ["Optimus Gen 3"] },
          { id: "boston", name: "Boston Dynamics", projects: ["Atlas"] },
        ],
      },
      {
        id: "nocode_ai",
        name: "No-Code AI Platforms",
        name_he: "פלטפורמות No-Code AI",
        description: "כלי AI ללא קוד, בניית אפליקציות",
      },
    ],
  },
  {
    id: "infrastructure",
    name: "Infrastructure & Training",
    name_he: "תשתיות ואימון",
    icon: "⚡",
    subfields: [
      {
        id: "model_training",
        name: "Model Training",
        name_he: "אימון מודלים",
        description: "Training, Fine-tuning, RLHF",
        ecosystem: [
          { id: "together", name: "Together AI", projects: ["Together Inference", "Together Fine-tuning"] },
          { id: "databricks", name: "Databricks", projects: ["Mosaic ML", "DBRX"] },
          { id: "scale", name: "Scale AI", projects: ["Scale Data Engine", "Scale Donovan"] },
        ],
      },
      {
        id: "cloud_ai",
        name: "Cloud AI Services",
        name_he: "שירותי AI בענן",
        description: "AWS, Azure, GCP - שירותי AI",
        ecosystem: [
          { id: "nvidia", name: "NVIDIA", projects: ["H200", "B200", "CUDA", "NIM"] },
          { id: "groq", name: "Groq", projects: ["LPU v2", "GroqCloud"] },
          { id: "cerebras", name: "Cerebras", projects: ["CS-3", "Inference Cloud"] },
        ],
      },
      {
        id: "edge_ai",
        name: "Edge AI",
        name_he: "Edge AI",
        description: "AI על מכשירים, מודלים קטנים, On-device",
        ecosystem: [
          { id: "apple_ai", name: "Apple Intelligence", projects: ["Apple Intelligence", "MLX"] },
          { id: "qualcomm", name: "Qualcomm", projects: ["Snapdragon X Elite", "AI Hub"] },
        ],
      },
      {
        id: "open_source",
        name: "Open Source Models",
        name_he: "מודלים פתוחים",
        description: "שחרורי מודלים פתוחים, Open Weights",
        ecosystem: [
          { id: "huggingface", name: "Hugging Face", projects: ["Transformers", "Hub", "Spaces"] },
          { id: "meta_open", name: "Meta Open Source", projects: ["Llama 4", "NLLB"] },
        ],
      },
      {
        id: "finetuning_platforms",
        name: "Fine-tuning Platforms",
        name_he: "פלטפורמות Fine-tuning",
        description: "כלים לכיוונון עדין של מודלים",
      },
    ],
  },
  {
    id: "applied",
    name: "Applied AI",
    name_he: "AI יישומי",
    icon: "🏢",
    subfields: [
      {
        id: "business_ai",
        name: "Business AI",
        name_he: "AI עסקי",
        description: "CRM, שיווק, ניתוח לקוחות",
        ecosystem: [
          { id: "salesforce", name: "Salesforce", projects: ["Einstein GPT", "Agentforce"] },
          { id: "microsoft_ai", name: "Microsoft AI", projects: ["Copilot", "Azure AI Studio"] },
        ],
      },
      {
        id: "education_ai",
        name: "Education AI",
        name_he: "AI בחינוך",
        description: "מורים וירטואליים, למידה מותאמת",
      },
      {
        id: "security_ai",
        name: "Security AI",
        name_he: "AI באבטחה",
        description: "סייבר, זיהוי איומים, הגנה",
      },
      {
        id: "data_analytics",
        name: "Data & Analytics",
        name_he: "נתונים וחיזוי",
        description: "מגמות, חיזוי, Anomaly Detection",
      },
      {
        id: "gaming_ai",
        name: "Gaming AI",
        name_he: "AI במשחקים",
        description: "NPC חכמים, יצירת תוכן למשחקים",
      },
    ],
  },
  {
    id: "frontier",
    name: "Frontier Research",
    name_he: "מחקר חזיתי",
    icon: "🔬",
    subfields: [
      {
        id: "agi",
        name: "AGI Research",
        name_he: "מחקר AGI",
        description: "התקדמות לקראת בינה כללית",
      },
      {
        id: "multimodal",
        name: "Multimodal AI",
        name_he: "Multimodal AI",
        description: "מודלים המשלבים טקסט, תמונה, קול",
      },
      {
        id: "neurosymbolic",
        name: "Neurosymbolic AI",
        name_he: "Neurosymbolic",
        description: "שילוב למידת מכונה והיגיון סמלי",
      },
      {
        id: "deep_learning",
        name: "Deep Learning",
        name_he: "למידה עמוקה",
        description: "ארכיטקטורות חדשות, חידושים משמעותיים בלבד",
      },
      {
        id: "bci",
        name: "Brain-Computer Interfaces",
        name_he: "ממשקי מוח-מחשב",
        description: "BCI, Neural Interfaces, Neuralink",
        ecosystem: [
          { id: "neuralink", name: "Neuralink", projects: ["N1 Implant", "Telepathy"] },
        ],
      },
    ],
  },
];

// Helper: Get all subfield IDs from selected domains
export function getSubfieldIds(domainIds: string[]): string[] {
  return DISCOVERY_TREE
    .filter(d => domainIds.includes(d.id))
    .flatMap(d => d.subfields.map(s => s.id));
}

// Helper: Get all ecosystem targets from selected subfields
export function getEcosystemTargets(subfieldIds: string[]): EcosystemTarget[] {
  return DISCOVERY_TREE
    .flatMap(d => d.subfields)
    .filter(s => subfieldIds.includes(s.id))
    .flatMap(s => s.ecosystem || []);
}

// Helper: Build focused search queries from selection
export function buildDiscoveryQueries(
  selectedDomains: string[],
  selectedSubfields: string[],
  selectedEcosystem: string[]
): string[] {
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const dateContext = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const queries: string[] = [];

  // From ecosystem targets (most specific)
  const ecosystemTargets = DISCOVERY_TREE
    .flatMap(d => d.subfields)
    .flatMap(s => s.ecosystem || [])
    .filter(e => selectedEcosystem.includes(e.id));

  for (const target of ecosystemTargets) {
    const projectsStr = target.projects.slice(0, 3).map(p => `"${p}"`).join(" OR ");
    queries.push(`${target.name} ${projectsStr} launch OR release OR announcement ${dateContext}`);
  }

  // From subfields (medium specificity)
  const subfields = DISCOVERY_TREE
    .flatMap(d => d.subfields)
    .filter(s => selectedSubfields.includes(s.id) && !s.ecosystem?.some(e => selectedEcosystem.includes(e.id)));

  for (const subfield of subfields) {
    queries.push(`"${subfield.name}" AI breakthrough OR release OR launch ${dateContext}`);
  }

  return queries;
}
