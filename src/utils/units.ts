// Pressure-unit helpers for the hydronic pump calculator.
// All internal values are stored in ft WC; psi is a display/entry convenience.
// Conversion uses exactly 2.3067 (spec/06 §6) for all fluids.

import { FT_PER_PSI } from '../calc/constants';

export const ftToPsi = (ft: number): number => ft / FT_PER_PSI;
export const psiToFt = (psi: number): number => psi * FT_PER_PSI;

/** Sanitize a project name / loop id for use in an export filename. */
export function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'project';
}
