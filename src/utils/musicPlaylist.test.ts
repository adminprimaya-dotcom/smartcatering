import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ATTACHED_MUSIC_URL,
  DEFAULT_MUSIC_TRACK,
  isValidAudioUrlOrPath,
  normalizeMusicTitle,
  resolveActiveTrack,
  resolveNextTrack,
  sanitizeAudioFilename,
} from './musicPlaylist';
import { MusicTrack } from '../types/erp';

test('normalizeMusicTitle cleans custom title or derives readable title from filename', () => {
  assert.equal(normalizeMusicTitle('  Kenny G - Songbird  '), 'Kenny G - Songbird');
  assert.equal(normalizeMusicTitle('', 'Kenny_G_-_Forever_In_Love.mp3'), 'Kenny G - Forever In Love');
  assert.equal(normalizeMusicTitle('', ''), 'Musik Latar Catering');
});

test('sanitizeAudioFilename restricts extension and strips unsafe path characters', () => {
  assert.equal(sanitizeAudioFilename('../../evil path/My Sax Song!.MP3'), 'My-Sax-Song.mp3');
  assert.equal(sanitizeAudioFilename('sound.exe'), 'sound.mp3');
  assert.equal(sanitizeAudioFilename('lounge_vibes.wav'), 'lounge_vibes.wav');
});

test('isValidAudioUrlOrPath accepts local assets, uploaded API files, and http/https URLs', () => {
  assert.equal(isValidAudioUrlOrPath(DEFAULT_ATTACHED_MUSIC_URL), true);
  assert.equal(isValidAudioUrlOrPath('/api/music/files/track-1.mp3'), true);
  assert.equal(isValidAudioUrlOrPath('https://cdn.example.com/audio/jazz.mp3'), true);
  assert.equal(isValidAudioUrlOrPath('javascript:alert(1)'), false);
  assert.equal(isValidAudioUrlOrPath(''), false);
});

test('resolveActiveTrack & resolveNextTrack cycle through active tracks cleanly', () => {
  const tracks: MusicTrack[] = [
    DEFAULT_MUSIC_TRACK,
    {
      id: 'track-2',
      title: 'Sax Lounge 2',
      audioUrl: '/api/music/files/sax-2.mp3',
      sourceType: 'upload',
      isActive: false,
      createdAt: '2026-11-16T01:00:00.000Z',
    },
    {
      id: 'track-3',
      title: 'Sax Lounge 3',
      audioUrl: '/api/music/files/sax-3.mp3',
      sourceType: 'url',
      isActive: true,
      createdAt: '2026-11-16T02:00:00.000Z',
    },
  ];

  assert.equal(resolveActiveTrack(tracks, 'track-2')?.id, DEFAULT_MUSIC_TRACK.id);
  assert.equal(resolveActiveTrack(tracks, 'track-3')?.id, 'track-3');
  assert.equal(resolveNextTrack(tracks, DEFAULT_MUSIC_TRACK.id)?.id, 'track-3');
  assert.equal(resolveNextTrack(tracks, 'track-3')?.id, DEFAULT_MUSIC_TRACK.id);
  assert.equal(resolveActiveTrack([], null), null);
});
