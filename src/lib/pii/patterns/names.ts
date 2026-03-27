import type { PIIMatch } from "../types";

let nameDictionary: Set<string> | null = null;
let loadedLocales: string[] = [];

export async function loadNameDictionaries(locales: string[]): Promise<void> {
  const sortedNew = [...locales].sort().join(",");
  const sortedOld = [...loadedLocales].sort().join(",");
  if (sortedNew === sortedOld && nameDictionary && nameDictionary.size > 0) return;

  const allNames: string[] = [];
  const results = await Promise.allSettled(
    locales.map(async (locale) => {
      try {
        const url = chrome.runtime.getURL(`dictionaries/names-${locale}.json`);
        const response = await fetch(url);
        if (response.ok) return (await response.json()) as string[];
      } catch {
        // Dictionary not available for this locale
      }
      return [];
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allNames.push(...result.value);
    }
  }

  nameDictionary = new Set(allNames.map((n) => n.toLowerCase()));
  loadedLocales = locales;
}

export function getNameDictionary(): Set<string> {
  return nameDictionary || new Set();
}

function turkishToLower(str: string): string {
  let result = "";
  for (const ch of str) {
    if (ch === "\u0130") result += "i";
    else if (ch === "I") result += "\u0131";
    else result += ch.toLowerCase();
  }
  return result;
}

function isInDictionary(word: string, dict: Set<string>): boolean {
  return dict.has(word.toLowerCase()) || dict.has(turkishToLower(word));
}

export function detectNames(text: string, pageIndex: number): PIIMatch[] {
  const dict = getNameDictionary();
  if (dict.size === 0) return [];

  const matches: PIIMatch[] = [];

  const titleCaseRegex =
    /(?<!\p{L})([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+)*)(?!\p{L})/gu;
  let match;
  while ((match = titleCaseRegex.exec(text)) !== null) {
    const fullMatch = match[1];
    const words = fullMatch.split(/\s+/);
    if (words.length < 2 || words.some((w) => w.length < 2)) continue;
    if (words.some((w) => isInDictionary(w, dict))) {
      matches.push({
        type: "names",
        value: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        pageIndex,
        confidence: 0.75,
      });
    }
  }

  const allCapsRegex =
    /(?<!\p{L})([\p{Lu}]{2,}(?:\s+[\p{Lu}]{2,})*)(?!\p{L})/gu;
  while ((match = allCapsRegex.exec(text)) !== null) {
    const fullMatch = match[1];
    const words = fullMatch.split(/\s+/);
    if (words.length < 2) continue;
    if (words.some((w) => isInDictionary(w, dict))) {
      matches.push({
        type: "names",
        value: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
        pageIndex,
        confidence: 0.7,
      });
    }
  }

  return matches;
}
