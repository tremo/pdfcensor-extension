export function validateIBAN(value: string): boolean {
  const cleaned = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numericStr = rearranged.split("").map((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 65 && code <= 90 ? (code - 55).toString() : ch;
  }).join("");
  let remainder = 0;
  for (let i = 0; i < numericStr.length; i++) {
    remainder = (remainder * 10 + parseInt(numericStr[i], 10)) % 97;
  }
  return remainder === 1;
}
