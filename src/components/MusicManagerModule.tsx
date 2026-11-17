import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Link2,
  Loader2,
  Music2,
  Play,
  Plus,
  Radio,
  Trash2,
  Upload,
} from 'lucide-react';
import { MusicTrack } from '../types/erp';

interface MusicManagerModuleProps {
  tracks: MusicTrack[];
  activeTrackId: string | null;
  onAddUploadedTrack: (payload: {
    title: string;
    fileName: string;
    dataBase64: string;
    setAsActive: boolean;
  }) => Promise<void>;
  onAddUrlTrack: (payload: {
    title: string;
    audioUrl: string;
    setAsActive: boolean;
  }) => Promise<void>;
  onSelectActiveTrack: (trackId: string) => Promise<void>;
  onToggleTrackActive: (trackId: string, isActive: boolean) => Promise<void>;
  onDeleteTrack: (track: MusicTrack) => Promise<void>;
}

export const MusicManagerModule: React.FC<MusicManagerModuleProps> = ({
  tracks,
  activeTrackId,
  onAddUploadedTrack,
  onAddUrlTrack,
  onSelectActiveTrack,
  onToggleTrackActive,
  onDeleteTrack,
}) => {
  const [sourceMode, setSourceMode] = useState<'upload' | 'url'>('upload');
  const [title, setTitle] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [setAsActive, setSetAsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFormError('');
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setFormError('Ukuran file audio maksimal 20 MB.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    if (!title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      setTitle(cleanName);
    }
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Gagal membaca file audio.'));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file audio.'));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (sourceMode === 'upload') {
      if (!selectedFile) {
        setFormError('Pilih file audio (MP3, WAV, OGG, atau M4A) terlebih dahulu.');
        return;
      }
      setSubmitting(true);
      try {
        const dataBase64 = await readFileAsDataUrl(selectedFile);
        await onAddUploadedTrack({
          title: title.trim(),
          fileName: selectedFile.name,
          dataBase64,
          setAsActive,
        });
        setTitle('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFormSuccess('Musik baru berhasil diunggah dan ditambahkan ke pemutar otomatis.');
        setTimeout(() => setFormSuccess(''), 4500);
      } catch (err) {
        setFormError(
          err instanceof Error ? err.message : 'Gagal mengunggah file musik ke server.'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!audioUrl.trim()) {
      setFormError('Masukkan URL audio yang valid (http/https atau path lokal).');
      return;
    }

    setSubmitting(true);
    try {
      await onAddUrlTrack({
        title: title.trim() || 'Musik Latar Baru',
        audioUrl: audioUrl.trim(),
        setAsActive,
      });
      setTitle('');
      setAudioUrl('');
      setFormSuccess('Musik dari URL berhasil ditambahkan ke daftar putar.');
      setTimeout(() => setFormSuccess(''), 4500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menambahkan URL musik.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeTrack = tracks.find((t) => t.id === activeTrackId && t.isActive) ||
    tracks.find((t) => t.isActive) ||
    null;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
              <Music2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                Kelola Musik Latar Website &amp; Aplikasi
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Musik aktif akan otomatis terputar saat aplikasi dibuka dengan tampilan ringkas berupa logo musik dan judul lagu.
              </p>
            </div>
          </div>

          {activeTrack && (
            <div className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs shrink-0 max-w-xs">
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                <span>Sedang Aktif (Auto-Play)</span>
              </div>
              <div className="font-bold text-white truncate mt-0.5">{activeTrack.title}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Musik Baru */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4 h-fit"
        >
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-700" />
              <span>Tambahkan Musik Baru</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah file MP3/WAV/OGG dari perangkat atau tempel tautan audio.
            </p>
          </div>

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Source Switcher */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSourceMode('upload');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                sourceMode === 'upload'
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload File Audio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSourceMode('url');
                setFormError('');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                sourceMode === 'url'
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Link / URL Audio</span>
            </button>
          </div>

          <div>
            <label
              htmlFor="music-title-input"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Judul Musik (Tampil di Aplikasi)
            </label>
            <input
              id="music-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Kenny G - Forever In Love"
              maxLength={120}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
            />
          </div>

          {sourceMode === 'upload' ? (
            <div key="source-upload-block">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pilih File Audio (MP3, WAV, OGG, M4A · Maks 20 MB)
              </label>
              <input
                key="music-file-input"
                ref={fileInputRef}
                id="music-file-input"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                onChange={handleFilePicked}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 px-4 py-5 text-center transition-colors"
              >
                <Upload className="h-5 w-5 text-emerald-700 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Klik untuk memilih file MP3 / Audio'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB siap diunggah`
                    : 'File disimpan di server agar langsung terputar bagi pelanggan'}
                </div>
              </button>
            </div>
          ) : (
            <div key="source-url-block">
              <label
                htmlFor="music-url-input"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                URL Audio MP3 / OGG
              </label>
              <input
                key="music-url-input"
                id="music-url-input"
                type="text"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                placeholder="https://contoh.com/lagu-kenny-g.mp3"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-hidden"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="rounded border-slate-300 accent-emerald-700"
            />
            <span>Langsung jadikan musik utama &amp; putar otomatis saat dibuka</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 px-4 py-2.5 text-xs font-bold text-white transition-colors"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{submitting ? 'Menyimpan Musik...' : 'Tambahkan & Simpan Musik'}</span>
          </button>
        </form>

        {/* Daftar Musik Tersimpan */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Daftar Musik Latar Tersimpan ({tracks.length})
              </h2>
              <p className="text-xs text-slate-500">
                Pilih musik utama atau kelola lagu yang ikut berputar otomatis.
              </p>
            </div>
          </div>

          {tracks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <Music2 className="h-7 w-7 text-slate-300 mx-auto" />
              <div className="font-semibold text-slate-700">Belum ada musik latar tersimpan</div>
              <div>Gunakan formulir di sebelah kiri untuk menambahkan musik baru.</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tracks.map((track, idx) => {
                const isPrimary = activeTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                      isPrimary ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 font-bold text-xs ${
                          isPrimary
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <Music2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {idx + 1}. {track.title}
                          </span>
                          {isPrimary && (
                            <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              Musik Utama
                            </span>
                          )}
                          {!track.isActive && (
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {track.sourceType === 'builtin'
                            ? 'Audio Bawaan Aplikasi'
                            : track.sourceType === 'upload'
                            ? `File Unggahan: ${track.fileName || 'Audio MP3'}`
                            : track.audioUrl}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => onSelectActiveTrack(track.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors"
                        >
                          <Play className="h-3 w-3" />
                          <span>Putar Sekarang</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleTrackActive(track.id, !track.isActive)}
                        className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors"
                      >
                        {track.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTrack(track)}
                        aria-label={`Hapus musik ${track.title}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
