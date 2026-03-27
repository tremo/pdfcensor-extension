import { detectPII } from "./pii/detector";
import { getRegulationPatterns } from "./pii/regulations";
import { maskText } from "./masker";
import type { PIIDetectionResult, PIIType, RegulationType } from "./pii/types";

export interface ScanOptions {
  regulation: RegulationType;
  piiTypes?: PIIType[];
  autoMask?: boolean;
}

export interface ScanResult extends PIIDetectionResult {
  masked?: string;
}

/**
 * Scan text for PII using the specified regulation profile.
 * Optionally auto-masks the text if autoMask is true.
 */
export function scanText(text: string, options: ScanOptions): ScanResult {
  const piiTypes = options.piiTypes || getRegulationPatterns(options.regulation);
  const result = detectPII(text, 0, piiTypes);

  let masked: string | undefined;
  if (options.autoMask && result.totalCount > 0) {
    masked = maskText(text, result.matches);
  }

  return {
    ...result,
    masked,
  };
}
