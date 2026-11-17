import { MusicTrack } from '../types/erp';

export const DEFAULT_ATTACHED_MUSIC_URL =
  '/assets/aistudio/Kenny_G_-_Forever_In_Love_-_krasivyj_saksofon_krasivaya_melodiya_-_legkoe_nenavyazchivoe_slushanie_Easy__mp3.pm__44ef1749.mp3';

export const DEFAULT_MUSIC_TRACK: MusicTrack = {
  id: 'track-kenny-g-forever-in-love',
  title: 'Kenny G - Forever In Love',
  audioUrl: DEFAULT_ATTACHED_MUSIC_URL,
  sourceType: 'builtin',
  fileName: 'Kenny G - Forever In Love.mp3',
  isActive: true,
  createdAt: '2026-11-16T00:00:00.000Z',
};

export function normalizeMusicTitle(rawTitle: string, fallbackFileName?: string): string {
  const cleaned = String(rawTitle || '').trim();
  if (cleaned.length > 0) {
    return cleaned.slice(0, 120);
  }
  const fromFile = String(fallbackFileName || '')
    .replace(/\.[^/.]+$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return fromFile.slice(0, 120) || 'Musik Latar Catering';
}

export function sanitizeAudioFilename(fileName: string): string {
  const base = String(fileName || 'music.mp3')
    .split(/[\\/]/)
    .pop() || 'music.mp3';
  const extMatch = base.match(/\.([a-zA-Z0-9]+)$/);
  const rawExt = extMatch ? extMatch[1].toLowerCase() : 'mp3';
  const allowedExts = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm']);
  const safeExt = allowedExts.has(rawExt) ? rawExt : 'mp3';
  const stem = base
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${stem || 'track'}.${safeExt}`;
}

export function isValidAudioUrlOrPath(rawUrl: string): boolean {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/api/music/files/')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveActiveTrack(
  tracks: MusicTrack[],
  activeTrackId: string | null
): MusicTrack | null {
  const activePool = tracks.filter((t) => t.isActive && Boolean(t.audioUrl));
  if (activePool.length === 0) return null;
  if (activeTrackId) {
    const matched = activePool.find((t) => t.id === activeTrackId);
    if (matched) return matched;
  }
  return activePool[0];
}

export function resolveNextTrack(
  tracks: MusicTrack[],
  currentTrackId: string | null
): MusicTrack | null {
  const activePool = tracks.filter((t) => t.isActive && Boolean(t.audioUrl));
  if (activePool.length === 0) return null;
  if (activePool.length === 1) return activePool[0];
  const currentIdx = activePool.findIndex((t) => t.id === currentTrackId);
  if (currentIdx === -1) return activePool[0];
  return activePool[(currentIdx + 1) % activePool.length];
}
