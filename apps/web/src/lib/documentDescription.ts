const MIN_TEXT_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 1600;
const MAX_SENTENCES = 12;

const STOP_WORDS = new Set(
  [
    "a", "about", "above", "after", "again", "against", "all",
    "also", "am", "an", "and", "any", "are", "as", "at", "be",
    "because", "been", "before", "being", "below", "between",
    "both", "but", "by", "can", "could", "did", "do", "does",
    "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "itself",
    "just", "may", "me", "might", "more", "most", "must", "my",
    "no", "nor", "not", "of", "off", "on", "once", "only",
    "or", "other", "our", "ours", "out", "over", "own", "same",
    "she", "should", "so", "some", "such", "than", "that",
    "the", "their", "theirs", "them", "themselves", "then",
    "there", "these", "they", "this", "those", "through", "to",
    "too", "under", "until", "up", "us", "very", "was", "we",
    "were", "what", "when", "where", "which", "while", "who",
    "whom", "why", "will", "with", "would", "you", "your",
    "yours"
  ],
);

const BOILERPLATE_PATTERNS = [
  /^page\s+\d+(\s+of\s+\d+)?$/i,
  /^confidential$/i,
  /^table of contents$/i,
  /^all rights reserved\.?$/i,
  /^www\.\S+$/i,
  /^https?:\/\/\S+$/i,
  /^[-_=*.\s]+$/,
];

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/^[ \t]*[-\\_=* \t]*\d+[ \t]+of[ \t]+\d+[-\\_=* \t]*[ \t]*$/gim, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tokenize(text: string): string[] {
  return (
    text.toLocaleLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []
  ).filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function isExtractionNoise(sentence: string): boolean {
  const value = sentence.replace(/\s+/g, " ").trim();
  const words = tokenize(value);
  const digits = (value.match(/\d/g) ?? []).length;
  const letters = (value.match(/\p{L}/gu) ?? []).length;

  if (!value) return true;
  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(value))) return true;
  if (/^(copyright|all rights reserved|tel(?:ephone)?|fax)\b/i.test(value)) return true;
  if (/^https?:\/\/|^www\./i.test(value)) return true;
  if (letters < 8 && digits > 0) return true;
  if (digits >= 12 && digits > letters * 2) return true;
  if (words.length < 2 && letters < 20) return true;

  return false;
}

function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/\bCopyright\b[^.\n]*(?:\n|$)/gi, " ")
    .replace(/\b(?:Tel|Telephone|Fax)\s*:\s*[^.\n]*(?:\n|$)/gi, " ")
    .replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n");

  return cleaned
    .split(/\n+/)
    .map((part) => part.replace(/^[\s•*-]+/, "").trim())
    .filter((part) => {
      if (part.length < 20 || part.length > 900) return false;
      return !isExtractionNoise(part);
    });
}

function scoreSentence(
  sentence: string,
  index: number,
  total: number,
  frequencies: Map<string, number>,
): number {
  const tokens = new Set(tokenize(sentence));
  const words = [...tokens];

  if (words.length === 0) return 0;

  const contentScore =
    words.reduce(
      (score, word) =>
        score + Math.log(1 + (frequencies.get(word) ?? 0)),
      0,
    ) / Math.sqrt(words.length);

  const purposeSignal =
    /\b(purpose|objective|scope|overview|summary|describes|explains|outlines|covers|establishes|provides|records|confirms|states|requires|applies|contains|includes|reports|findings|conclusion|recommendation|instructions|results|decision|agreement|payment|amount|date|issued|valid|expiry|expires|applicant|customer|employee|student|reference|account|total|assessment|requirements|responsibilities|procedure|process|policy|terms|conditions)\b/i.test(sentence)
      ? 2
      : 0;

  const detailSignal =
    /\b\d[\d,./:%-]*\b/.test(sentence) ||
    /\b(?:19|20)\d{2}\b/.test(sentence) ||
    /\b(?:KES|USD|EUR|GBP|KSh)\b/i.test(sentence)
      ? 0.9
      : 0;

  const openingSignal =
    index < Math.max(2, Math.ceil(total * 0.15)) ? 1.4 : 0;

  const lengthSignal =
    sentence.length >= 55 && sentence.length <= 320
      ? 1
      : sentence.length > 600
        ? -1
        : 0;

  return contentScore + purposeSignal + detailSignal + openingSignal + lengthSignal;
}

function inferDocumentType(text: string): string {
  const value = text.toLocaleLowerCase();

  const categories = [
    {
      name: "legal document",
      terms: ["contract", "agreement", "hereby", "party to", "clause", "liability", "indemnity", "jurisdiction", "privity of contract", "intellectual property rights"],
    },
    {
      name: "operational document",
      terms: ["operational procedure", "standard operating procedure", "workflow", "work instructions", "operational policy", "process owner", "day-to-day operations"],
    },
    {
      name: "engineering document",
      terms: ["engineering design", "engineering assessment", "engineering report", "technical specification", "structural design", "load bearing", "system architecture", "design calculations", "engineering assessment"],
    },
    {
      name: "financial document",
      terms: ["financial statement", "balance sheet", "income statement", "cash flow", "accounts payable", "accounts receivable", "financial year", "expenditure report"],
    },
    {
      name: "medical document",
      terms: ["clinical diagnosis", "patient history", "treatment plan", "medical examination", "clinical findings", "prescription", "patient record"],
    },
    {
      name: "human resources document",
      terms: ["employee benefits", "staff appraisal", "leave entitlement", "employment policy", "job description", "human resources", "disciplinary procedure"],
    },
    {
      name: "education document",
      terms: ["learning objectives", "course syllabus", "lesson plan", "student assessment", "curriculum", "academic transcript", "educational programme"],
    },
    {
      name: "records management document",
      terms: ["records retention", "records management", "retention schedule", "document classification", "disposal of records", "archival records"],
    },
    {
      name: "technical report",
      terms: ["technical report", "test results", "system performance", "methodology", "technical findings", "implementation results"],
    },
    {
      name: "policy document",
      terms: ["policy statement", "scope of this policy", "policy objectives", "policy requirements", "policy applies", "compliance with this policy"],
    },
  ];

  let bestName = "";
  let bestScore = 0;

  for (const category of categories) {
    let score = 0;
    for (const term of category.terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matches = value.match(new RegExp(`\\b${escaped}\\b`, "g"));
      if (matches) score += Math.min(matches.length, 3);
    }

    if (score > bestScore) {
      bestScore = score;
      bestName = category.name;
    }
  }

  return bestScore >= 2 ? bestName : "";
}

function sentenceSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let shared = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) shared++;
  }

  return shared / (leftTokens.size + rightTokens.size - shared);
}

function removeNearDuplicateSentences(sentences: string[]): string[] {
  const unique: string[] = [];

  for (const sentence of sentences) {
    const normalized = sentence
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) continue;

    const duplicate = unique.some((existing) => {
      const existingNormalized = existing
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      return normalized === existingNormalized ||
        sentenceSimilarity(normalized, existingNormalized) >= 0.78;
    });

    if (!duplicate) unique.push(sentence);
  }

  return unique;
}

export function generateLocalDocumentDescription(
  extractedText: string,
  previousDescription = "",
): string {
  const text = normalizeText(extractedText);

  if (text.length < MIN_TEXT_LENGTH) return "";

  const sentences = removeNearDuplicateSentences(splitSentences(text));

  if (sentences.length === 0) {
    return text.length <= MAX_DESCRIPTION_LENGTH
      ? text
      : `${text.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
  }

  const frequencies = new Map<string, number>();

  for (const sentence of sentences) {
    for (const word of new Set(tokenize(sentence))) {
      frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
    }
  }

  const previousSentences = new Set(
    splitSentences(normalizeText(previousDescription)).map((sentence) =>
      sentence.toLocaleLowerCase(),
    ),
  );

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      tokens: new Set(tokenize(sentence)),
      score:
        scoreSentence(sentence, index, sentences.length, frequencies) -
        (previousSentences.has(sentence.toLocaleLowerCase()) ? 100 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const selected: typeof ranked = [];
  const selectedTokens = new Set<string>();
  let currentLength = 0;

  for (const candidate of ranked) {
    if (selected.length >= MAX_SENTENCES) break;

    const overlap = [...candidate.tokens].filter((word) =>
      selectedTokens.has(word),
    ).length;

    const overlapRatio = overlap / Math.max(candidate.tokens.size, 1);
    if (selected.length > 0 && overlapRatio > 0.72) continue;

    const separatorLength = selected.length > 0 ? 1 : 0;
    const remaining =
      MAX_DESCRIPTION_LENGTH - currentLength - separatorLength;

    if (remaining < 35) continue;

    let sentence = candidate.sentence;

    if (sentence.length > remaining) {
      const cut = sentence.slice(0, remaining);
      const lastSpace = cut.lastIndexOf(" ");

      if (lastSpace < Math.min(remaining * 0.65, 35)) continue;

      sentence = `${cut.slice(0, lastSpace).trimEnd()}…`;
    }

    selected.push({ ...candidate, sentence });
    currentLength += sentence.length + separatorLength;

    for (const word of candidate.tokens) {
      selectedTokens.add(word);
    }
  }

  const body = selected
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence)
    .join(" ")
    .trim();

  if (!body) return "";

  const documentType = inferDocumentType(text);
  const opening = documentType
    ? `This document is ${/^[aeiou]/i.test(documentType) ? "an" : "a"} ${documentType}.`
    : "";

  const description = opening ? `${opening} ${body}` : body;

  return description.length <= MAX_DESCRIPTION_LENGTH
    ? description
    : `${description.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
}
