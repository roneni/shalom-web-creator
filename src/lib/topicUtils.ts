// Topic-to-emoji mapping based on the AI topics list
export interface TopicInfo {
  id: string;
  name: string;
  emoji: string;
}

export const topicMap: Record<string, TopicInfo> = {
  "3d_generation":       { id: "3d_generation",       name: "יצירת 3D",              emoji: "🧊" },
  "agi":                 { id: "agi",                  name: "AGI",                    emoji: "🧠" },
  "ai_agents":           { id: "ai_agents",            name: "סוכני AI",               emoji: "🤖" },
  "ar_vr":               { id: "ar_vr",                name: "מציאות רבודה/מדומה",     emoji: "🥽" },
  "audio_generation":    { id: "audio_generation",     name: "יצירת אודיו",           emoji: "🎵" },
  "bci":                 { id: "bci",                  name: "ממשקי מוח-מחשב",        emoji: "🧬" },
  "business_ai":         { id: "business_ai",          name: "AI עסקי",                emoji: "💼" },
  "chatbots":            { id: "chatbots",             name: "צ׳אטבוטים",             emoji: "💬" },
  "cloud_ai":            { id: "cloud_ai",             name: "שירותי AI בענן",         emoji: "☁️" },
  "data_analytics":      { id: "data_analytics",       name: "ניתוח נתונים",           emoji: "📊" },
  "deep_learning":       { id: "deep_learning",        name: "למידה עמוקה",            emoji: "🔬" },
  "edge_ai":             { id: "edge_ai",              name: "Edge AI",                emoji: "📱" },
  "education_ai":        { id: "education_ai",         name: "AI בחינוך",              emoji: "🎓" },
  "finetuning_platforms":{ id: "finetuning_platforms",  name: "Fine-tuning",            emoji: "⚙️" },
  "gaming_ai":           { id: "gaming_ai",            name: "AI במשחקים",             emoji: "🎮" },
  "image_generation":    { id: "image_generation",     name: "יצירת תמונות",           emoji: "🎨" },
  "model_training":      { id: "model_training",       name: "אימון מודלים",           emoji: "🏋️" },
  "multimodal":          { id: "multimodal",           name: "Multimodal AI",          emoji: "🔀" },
  "neurosymbolic":       { id: "neurosymbolic",        name: "Neurosymbolic AI",       emoji: "🧩" },
  "nocode_ai":           { id: "nocode_ai",            name: "No-Code AI",             emoji: "🛠️" },
  "object_detection":    { id: "object_detection",     name: "זיהוי אובייקטים",       emoji: "👁️" },
  "ocr":                 { id: "ocr",                  name: "זיהוי טקסט",             emoji: "📄" },
  "open_source":         { id: "open_source",          name: "מודלים פתוחים",          emoji: "🔓" },
  "prompt_engineering":  { id: "prompt_engineering",   name: "הנדסת פרומפטים",         emoji: "✍️" },
  "robotics":            { id: "robotics",             name: "רובוטיקה",               emoji: "🦾" },
  "rpa":                 { id: "rpa",                  name: "אוטומציה",               emoji: "⚡" },
  "security_ai":         { id: "security_ai",          name: "אבטחה ופרטיות",          emoji: "🛡️" },
  "semantic_search":     { id: "semantic_search",      name: "חיפוש סמנטי",            emoji: "🔍" },
  "sentiment_analysis":  { id: "sentiment_analysis",   name: "ניתוח סנטימנט",          emoji: "😊" },
  "speech":              { id: "speech",               name: "דיבור ושפה",             emoji: "🗣️" },
  "text_generation":     { id: "text_generation",      name: "יצירת טקסט",             emoji: "✏️" },
  "text_summarization":  { id: "text_summarization",   name: "סיכום טקסטים",           emoji: "📝" },
  "translation":         { id: "translation",          name: "תרגום אוטומטי",          emoji: "🌐" },
  "video_generation":    { id: "video_generation",     name: "יצירת וידאו",            emoji: "🎬" },
};

// Keyword-based matching: maps tag values (from published_posts.tag) to topic IDs
const tagToTopicMapping: Record<string, string> = {
  // Hebrew tags
  "סוכני AI":        "ai_agents",
  "רובוטיקה":        "robotics",
  "פרומפטים":        "prompt_engineering",
  "פתרונות עסקיים":  "business_ai",
  "כלי פיתוח":       "text_generation",
  "חיפוש":           "semantic_search",
  "קול ואודיו":      "speech",
  "וידאו":           "video_generation",
  "סטארטאפים":       "business_ai",
  "תרבות":           "video_generation",
  "אנבידיה":         "model_training",
  "אלגוריתם X":      "deep_learning",
  // English tags
  "GPT-5":           "chatbots",
  "Gemini":          "multimodal",
  "Claude":          "chatbots",
  "Open Source":     "open_source",
  "ChatGPT":         "chatbots",
  "Midjourney":      "image_generation",
  "GitHub":          "text_generation",
  "Perplexity":      "semantic_search",
  "Spatial AI":      "ar_vr",
  "enterprise":      "business_ai",
  "Google Labs":     "multimodal",
  // Common keyword fallbacks
  "image":           "image_generation",
  "video":           "video_generation",
  "audio":           "audio_generation",
  "code":            "text_generation",
  "search":          "semantic_search",
  "robot":           "robotics",
  "agent":           "ai_agents",
  "security":        "security_ai",
  "open source":     "open_source",
  "training":        "model_training",
};

/**
 * Get topic info for a given post tag.
 * Tries exact match first, then keyword-based fuzzy match.
 */
export function getTopicForTag(tag: string | undefined | null): TopicInfo | null {
  if (!tag) return null;

  // 1. Direct match in topicMap (if tag IS a topic id)
  if (topicMap[tag]) return topicMap[tag];

  // 2. Exact match in tagToTopicMapping
  if (tagToTopicMapping[tag]) return topicMap[tagToTopicMapping[tag]] || null;

  // 3. Case-insensitive match
  const lowerTag = tag.toLowerCase();
  for (const [key, topicId] of Object.entries(tagToTopicMapping)) {
    if (key.toLowerCase() === lowerTag) {
      return topicMap[topicId] || null;
    }
  }

  // 4. Keyword substring match
  for (const [keyword, topicId] of Object.entries(tagToTopicMapping)) {
    if (lowerTag.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(lowerTag)) {
      return topicMap[topicId] || null;
    }
  }

  return null;
}
