import { Injectable } from '@nestjs/common';
import exifr from 'exifr';
import { TamperStatus } from '@blue-card/shared';
import { StoredObject } from '../storage/storage.service';
import { TamperResult, TamperScorer } from './tamper-scorer';

export interface TamperThresholds {
  suspect: number;
  flagged: number;
}

// Editing tools whose presence in EXIF "Software" strongly suggests the image
// was processed after capture.
const EDITOR_HINTS = [
  'photoshop',
  'gimp',
  'lightroom',
  'snapseed',
  'pixlr',
  'paint.net',
  'ms paint',
  'paint',
  'affinity',
  'canva',
  'picsart',
  'faceapp',
  'acdsee',
  'photoscape',
  'inkscape',
];

// Weighted signals derived from metadata + format. These are heuristics, not
// proof — they bias a human reviewer's attention. ELA / a forensics API can be
// layered in by replacing this scorer (same TamperScorer interface).
const WEIGHTS = {
  nonJpeg: 0.25, // real ID photos are camera JPEGs; PNG often = screenshot/export
  noExif: 0.3, // genuine camera captures carry EXIF
  editorSoftware: 0.5, // edited in a known image editor
  noCameraSource: 0.2, // software present but no camera make/model
  dateMismatch: 0.2, // modify date differs from capture date
};

@Injectable()
export class HeuristicTamperScorer extends TamperScorer {
  constructor(private readonly thresholds: TamperThresholds) {
    super();
  }

  async score(image: StoredObject): Promise<TamperResult> {
    const signals: Record<string, number | string | boolean> = {};
    let score = 0;
    const add = (key: keyof typeof WEIGHTS, on: boolean) => {
      signals[key] = on;
      if (on) score += WEIGHTS[key];
    };

    const isJpeg = /jpe?g/i.test(image.contentType);
    add('nonJpeg', !isJpeg);

    let exif: Record<string, unknown> | undefined;
    try {
      exif = (await exifr.parse(image.buffer)) as Record<string, unknown> | undefined;
    } catch {
      exif = undefined;
    }

    const hasExif = !!exif && Object.keys(exif).length > 0;
    add('noExif', !hasExif);

    const software = String(exif?.Software ?? '').toLowerCase();
    const editor = EDITOR_HINTS.find((h) => software.includes(h));
    add('editorSoftware', !!editor);
    if (editor) signals.editor = editor;

    const hasCameraSource = !!(exif?.Make || exif?.Model);
    // Only meaningful when there IS metadata to judge.
    add('noCameraSource', hasExif && !!software && !hasCameraSource);

    const original = exif?.DateTimeOriginal;
    const modified = exif?.ModifyDate;
    const dateMismatch =
      original instanceof Date &&
      modified instanceof Date &&
      Math.abs(modified.getTime() - original.getTime()) > 60_000;
    add('dateMismatch', dateMismatch);

    score = Math.min(1, Number(score.toFixed(3)));
    return { score, status: this.toStatus(score), signals };
  }

  private toStatus(score: number): TamperStatus {
    if (score >= this.thresholds.flagged) return TamperStatus.Flagged;
    if (score >= this.thresholds.suspect) return TamperStatus.Suspect;
    return TamperStatus.Clean;
  }
}
