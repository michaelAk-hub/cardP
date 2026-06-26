import { TamperStatus } from '@blue-card/shared';
import { StoredObject } from '../storage/storage.service';

export interface TamperResult {
  score: number; // 0..1, higher = more suspicious
  status: TamperStatus; // clean | suspect | flagged (advisory)
  signals: Record<string, number | string | boolean>;
}

// Pluggable tamper scorer. Swap in a document-forensics API by providing
// another implementation. Results are ADVISORY — the human reviewer decides
// (spec §6.4); nothing here ever auto-rejects.
export abstract class TamperScorer {
  abstract score(image: StoredObject): Promise<TamperResult>;
}
