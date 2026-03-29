import { detectPII } from "./pii/detector";
import { getRegulationPatterns } from "./pii/regulations";
import type { PIIDetectionResult, PIIType, RegulationType } from "./pii/types";

export interface ScanOptions {
  regulation: RegulationType;
  piiTypes?: PIIType[];
}

export interface ScanResult extends PIIDetectionResult {}

/**
 * Scan text for PII using the specified regulation profile.
 * Returns detection results.
 */
export function scanText(text: string, options: ScanOptions): ScanResult {
  const piiTypes = options.piiTypes || getRegulationPatterns(options.regulation);
  const result = detectPII(text, 0, piiTypes);

  return {
    ...result,
  };
}
