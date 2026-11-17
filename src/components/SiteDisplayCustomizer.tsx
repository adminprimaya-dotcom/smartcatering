import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Eye,
  Image as ImageIcon,
  LayoutTemplate,
  MapPin,
  Palette,
  QrCode,
  RotateCcw,
  Save,
  Sparkles,
  Tag,
} from 'lucide-react';
import { SiteContentSettings } from '../types/erp';
import { DEFAULT_SITE_SETTINGS, GENERATED_IMAGES } from '../data/seedData';
import {
  DEFAULT_BOTANICAL_ORNAMENT_URL,
  resolveThemePreset,
  THEME_LIST,
} from '../utils/themePresets';

interface SiteDisplayCustomizerProps {
  settings: SiteContentSettings;
  onSaveSettings: (nextSettings: SiteContentSettings) => Promise<void>;
  onPreviewCustomerStorefront: () => void;
}

type CustomizerTab = 'brand' | 'hero' | 'katalog' | 'tentang' | 'kontak';

export const SiteDisplayCustomizer: React.FC<SiteDisplayCustomizerProps> = ({
  settings,
  onSaveSettings,
  onPreviewCustomerStorefront,
}) => {
  const [form, setForm] = useState<SiteContentSettings>(settings);
  const [activeTab, setActiveTab] = useState<CustomizerTab>('brand');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const qrisFileInputRef = useRef<HTMLInputElement | null>(null);
  const ornamentFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleQrisFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('qrisImageUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOrnamentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({
          ...prev,
          themeOrnamentEnabled: true,
          themeOrnamentUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = <K extends keyof SiteContentSettings>(
    key: K,
    value: SiteContentSettings[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');
    try {
      await onSaveSettings(form);
      setFeedback(
        'Seluruh perubahan isi tampilan website & dashboard berhasil disimpan dan langsung aktif!'
      );
      setTimeout(() => setFeedback(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async () => {
    setForm(DEFAULT_SITE_SETTINGS);
    setSaving(true);
    try {
      await onSaveSettings(DEFAULT_SITE_SETTINGS);
      setFeedback('Seluruh isi tampilan berhasil dikembalikan ke pengaturan standar awal.');
      setTimeout(() => setFeedback(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Executive Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="bg-slate-900 px-6 py-5 text-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shrink-0">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Studio Kustomisasi Tampilan & Konten Terpadu (CMS Admin)</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
                Kelola & Ubah Semua Isi Tampilan Website dan Sistem
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Ubah nama brand, judul header, teks banner utama, foto sampul, deskripsi katalog, info tentang kami, hingga nomor WhatsApp & rekening bank secara langsung.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onPreviewCustomerStorefront}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Eye className="h-4 w-4 text-emerald-400" />
              <span>Lihat Hasil di Web Pelanggan</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefault}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Standar</span>
            </button>
          </div>
        </div>

        {/* Category Section Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-5 py-2.5">
          {[
            { key: 'brand', label: '1. Brand, Header & Tema', icon: Palette },
            { key: 'hero', label: '2. Banner Utama (Hero) & Foto', icon: ImageIcon },
            { key: 'katalog', label: '3. Teks Katalog, Promo & Pelacakan', icon: Tag },
            { key: 'tentang', label: '4. Tentang Kami & Keunggulan', icon: Building2 },
            { key: 'kontak', label: '5. Kontak, Rekening Bank & QRIS', icon: MapPin },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as CustomizerTab)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={onPreviewCustomerStorefront}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
          >
            Buka Web Pelanggan →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: BRAND, HEADER & TEMA WARNA */}
        {activeTab === 'brand' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                1. Pengaturan Identitas Brand, Header & Tema Warna
              </h2>
              <p className="text-xs text-slate-500">
                Ubah nama perusahaan di pojok kiri atas website pelanggan, judul sistem ERP di header admin, serta tema warna utama.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cms-brand-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Brand Utama (Tampil di Header Pelanggan & Sidebar Admin)
                </label>
                <input
                  id="cms-brand-name"
                  type="text"
                  value={form.brandName}
                  onChange={(e) => updateField('brandName', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-brand-tagline"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Sub-Judul / Tagline Brand
                </label>
                <input
                  id="cms-brand-tagline"
                  type="text"
                  value={form.brandTagline}
                  onChange={(e) => updateField('brandTagline', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-erp-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Judul Lengkap Sistem (Tampil di Header Admin & Kop Laporan Keuangan)
                </label>
                <input
                  id="cms-erp-title"
                  type="text"
                  value={form.erpSystemTitle}
                  onChange={(e) => updateField('erpSystemTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-erp-subtitle"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Sub-Keterangan Header Admin
                </label>
                <input
                  id="cms-erp-subtitle"
                  type="text"
                  value={form.erpHeaderSubtitle}
                  onChange={(e) => updateField('erpHeaderSubtitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-footer-copy"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Teks Hak Cipta Footer (Bagian Bawah Halaman)
                </label>
                <input
                  id="cms-footer-copy"
                  type="text"
                  value={form.footerCopyright}
                  onChange={(e) => updateField('footerCopyright', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2 pt-3 border-t border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Palette className="h-4 w-4 text-emerald-700" />
                      <span>Galeri Tema Tampilan &amp; Ornamen Artistik</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih palet warna, gaya tipografi, dan ornamen visual untuk Website Pelanggan serta Panel Admin.
                    </p>
                  </div>
                  <select
                    id="cms-accent-theme"
                    aria-label="Pilih Tema Tampilan"
                    value={form.accentTheme}
                    onChange={(e) => {
                      const nextKey = e.target.value as SiteContentSettings['accentTheme'];
                      const preset = resolveThemePreset(nextKey);
                      setForm((prev) => ({
                        ...prev,
                        accentTheme: nextKey,
                        themeOrnamentEnabled: preset.supportsOrnament,
                        themeOrnamentUrl:
                          prev.themeOrnamentUrl || DEFAULT_BOTANICAL_ORNAMENT_URL,
                      }));
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                  >
                    {THEME_LIST.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Visual Interactive Theme Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {THEME_LIST.map((preset) => {
                    const selected = form.accentTheme === preset.key;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            accentTheme: preset.key,
                            themeOrnamentEnabled: preset.supportsOrnament,
                            themeOrnamentUrl:
                              prev.themeOrnamentUrl || DEFAULT_BOTANICAL_ORNAMENT_URL,
                          }));
                        }}
                        className={`text-left rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                          selected
                            ? 'border-slate-900 ring-2 ring-slate-900/15 bg-slate-50/70'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {preset.swatches.map((hex, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="h-4 w-4 rounded-full border border-black/10"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                            {selected && (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Aktif</span>
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="text-xs font-bold text-slate-900">{preset.name}</div>
                            <div className="text-[11px] font-semibold text-slate-500">
                              {preset.tagline}
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {preset.description}
                          </p>
                        </div>

                        {preset.supportsOrnament && (
                          <div className="rounded-lg border border-[#E4DCD0] bg-[#FAF7F2] h-14 overflow-hidden flex items-end justify-center pt-1">
                            <img
                              src={form.themeOrnamentUrl || DEFAULT_BOTANICAL_ORNAMENT_URL}
                              alt="Pratinjau Ornamen Flora Nusantara"
                              referrerPolicy="no-referrer"
                              className="h-20 w-20 object-contain object-bottom mix-blend-multiply"
                            />
                            <img
                              src={form.themeOrnamentUrl || DEFAULT_BOTANICAL_ORNAMENT_URL}
                              alt=""
                              aria-hidden="true"
                              referrerPolicy="no-referrer"
                              className="h-20 w-20 object-contain object-bottom mix-blend-multiply -scale-x-100 -ml-2"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Ornamen Artistik Flora Controls */}
                <div className="rounded-xl border border-[#E4DCD0] bg-[#FAF7F2] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        Ornamen Ilustrasi Flora pada Tema
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Menampilkan ilustrasi flora artistik di transisi hero, kartu promo, tentang kami, dan horizon footer.
                      </div>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={
                          form.themeOrnamentEnabled !== undefined
                            ? form.themeOrnamentEnabled
                            : form.accentTheme === 'flora-elegan'
                        }
                        onChange={(e) => updateField('themeOrnamentEnabled', e.target.checked)}
                        className="rounded border-slate-300 accent-[#C43E24]"
                      />
                      <span>Aktifkan Ornamen Flora</span>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                    <div className="h-14 w-14 rounded-lg border border-[#E4DCD0] bg-white overflow-hidden shrink-0 flex items-end justify-center p-1">
                      <img
                        src={form.themeOrnamentUrl || DEFAULT_BOTANICAL_ORNAMENT_URL}
                        alt="Artwork Ornamen Tema"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        aria-label="URL Gambar Ornamen Tema"
                        value={form.themeOrnamentUrl || ''}
                        onChange={(e) => updateField('themeOrnamentUrl', e.target.value)}
                        placeholder={DEFAULT_BOTANICAL_ORNAMENT_URL}
                        className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900"
                      />
                      <input
                        ref={ornamentFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleOrnamentFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => ornamentFileInputRef.current?.click()}
                        className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap"
                      >
                        Unggah Ornamen
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            themeOrnamentUrl: DEFAULT_BOTANICAL_ORNAMENT_URL,
                            themeOrnamentEnabled: true,
                          }))
                        }
                        className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                      >
                        Ornamen Bawaan
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BANNER UTAMA (HERO) & FOTO */}
        {activeTab === 'hero' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                2. Pengaturan Banner Utama (Hero) Halaman Depan Pelanggan
              </h2>
              <p className="text-xs text-slate-500">
                Atur judul besar, teks deskripsi, label tombol, angka sorotan keunggulan, dan gambar utama di halaman depan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label
                  htmlFor="cms-hero-badge"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Teks Label Atas Banner (Sertifikasi / Slogan Atas)
                </label>
                <input
                  id="cms-hero-badge"
                  type="text"
                  value={form.heroBadge}
                  onChange={(e) => updateField('heroBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="cms-hero-title"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Judul Utama Banner (Headline Besar)
                </label>
                <input
                  id="cms-hero-title"
                  type="text"
                  value={form.heroTitle}
                  onChange={(e) => updateField('heroTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="cms-hero-desc"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Deskripsi Lengkap Banner Utama
                </label>
                <textarea
                  id="cms-hero-desc"
                  rows={2}
                  value={form.heroDescription}
                  onChange={(e) => updateField('heroDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label
                  htmlFor="cms-hero-img"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  URL Foto Banner Utama
                </label>
                <input
                  id="cms-hero-img"
                  type="text"
                  value={form.heroImageUrl}
                  onChange={(e) => updateField('heroImageUrl', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-mono text-slate-900"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500">Pilih Cepat Foto Tersedia:</span>
                  <button
                    type="button"
                    onClick={() => updateField('heroImageUrl', GENERATED_IMAGES.prasmanan)}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Foto Prasmanan VIP
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('heroImageUrl', GENERATED_IMAGES.nasiKotak)}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Foto Nasi Kotak Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('heroImageUrl', GENERATED_IMAGES.sekolahMeal)}
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Foto Paket Gizi Sehat
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="cms-hero-cap1"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Teks Keterangan Foto (Baris 1)
                  </label>
                  <input
                    id="cms-hero-cap1"
                    type="text"
                    value={form.heroImageCaptionTitle}
                    onChange={(e) => updateField('heroImageCaptionTitle', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cms-hero-cap2"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Teks Keterangan Foto (Baris 2)
                  </label>
                  <input
                    id="cms-hero-cap2"
                    type="text"
                    value={form.heroImageCaptionSubtitle}
                    onChange={(e) => updateField('heroImageCaptionSubtitle', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* 3 Button Labels & 3 Highlight Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Label Tombol 1 (Lihat Menu)
                </label>
                <input
                  type="text"
                  value={form.heroBtnPrimary}
                  onChange={(e) => updateField('heroBtnPrimary', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Label Tombol 2 (Pesan Sekarang)
                </label>
                <input
                  type="text"
                  value={form.heroBtnSecondary}
                  onChange={(e) => updateField('heroBtnSecondary', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Label Tombol 3 (WhatsApp)
                </label>
                <input
                  type="text"
                  value={form.heroBtnWhatsapp}
                  onChange={(e) => updateField('heroBtnWhatsapp', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Sorotan Banner 1
                </span>
                <input
                  type="text"
                  value={form.stat1Title}
                  onChange={(e) => updateField('stat1Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <input
                  type="text"
                  value={form.stat1Desc}
                  onChange={(e) => updateField('stat1Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Sorotan Banner 2
                </span>
                <input
                  type="text"
                  value={form.stat2Title}
                  onChange={(e) => updateField('stat2Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <input
                  type="text"
                  value={form.stat2Desc}
                  onChange={(e) => updateField('stat2Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Sorotan Banner 3
                </span>
                <input
                  type="text"
                  value={form.stat3Title}
                  onChange={(e) => updateField('stat3Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <input
                  type="text"
                  value={form.stat3Desc}
                  onChange={(e) => updateField('stat3Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEKS KATALOG, PROMO & PELACAKAN */}
        {activeTab === 'katalog' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                3. Pengaturan Judul & Deskripsi Katalog, Promo, serta Lacak Pesanan
              </h2>
              <p className="text-xs text-slate-500">
                Sesuaikan kalimat pengantar pada bagian Katalog Makanan, Program Voucher Promo, dan Lacak Pesanan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Label Katalog Makanan
                </label>
                <input
                  type="text"
                  value={form.catalogBadge}
                  onChange={(e) => updateField('catalogBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Bagian Katalog Makanan
                </label>
                <input
                  type="text"
                  value={form.catalogTitle}
                  onChange={(e) => updateField('catalogTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Panduan Katalog Makanan
                </label>
                <input
                  type="text"
                  value={form.catalogDescription}
                  onChange={(e) => updateField('catalogDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Label Bagian Promo
                </label>
                <input
                  type="text"
                  value={form.promoBadge}
                  onChange={(e) => updateField('promoBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Bagian Promo Diskon
                </label>
                <input
                  type="text"
                  value={form.promoTitle}
                  onChange={(e) => updateField('promoTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Label Pelacakan Pesanan
                </label>
                <input
                  type="text"
                  value={form.trackingBadge}
                  onChange={(e) => updateField('trackingBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Bagian Lacak Pesanan
                </label>
                <input
                  type="text"
                  value={form.trackingTitle}
                  onChange={(e) => updateField('trackingTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deskripsi Petunjuk Lacak Pesanan
                </label>
                <textarea
                  rows={2}
                  value={form.trackingDescription}
                  onChange={(e) => updateField('trackingDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TENTANG KAMI & KEUNGGULAN */}
        {activeTab === 'tentang' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                4. Pengaturan Bagian Tentang Kami & 3 Pilar Keunggulan
              </h2>
              <p className="text-xs text-slate-500">
                Ubah profil perusahaan, penjelasan layanan, serta 3 kartu keunggulan utama di halaman depan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Label Tentang Kami
                </label>
                <input
                  type="text"
                  value={form.aboutBadge}
                  onChange={(e) => updateField('aboutBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Utama Tentang Kami
                </label>
                <input
                  type="text"
                  value={form.aboutTitle}
                  onChange={(e) => updateField('aboutTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paragraf Deskripsi Tentang Kami
                </label>
                <textarea
                  rows={3}
                  value={form.aboutDescription}
                  onChange={(e) => updateField('aboutDescription', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Pilar Keunggulan 1
                </span>
                <input
                  type="text"
                  value={form.feature1Title}
                  onChange={(e) => updateField('feature1Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.feature1Desc}
                  onChange={(e) => updateField('feature1Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Pilar Keunggulan 2
                </span>
                <input
                  type="text"
                  value={form.feature2Title}
                  onChange={(e) => updateField('feature2Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.feature2Desc}
                  onChange={(e) => updateField('feature2Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase">
                  Pilar Keunggulan 3
                </span>
                <input
                  type="text"
                  value={form.feature3Title}
                  onChange={(e) => updateField('feature3Title', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
                />
                <textarea
                  rows={2}
                  value={form.feature3Desc}
                  onChange={(e) => updateField('feature3Desc', e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: KONTAK, WHATSAPP & REKENING PEMBAYARAN */}
        {activeTab === 'kontak' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                5. Pengaturan Alamat Dapur, Nomor WhatsApp & Rekening Bank
              </h2>
              <p className="text-xs text-slate-500">
                Informasi ini tampil pada blok Hubungi Kami, Kop Laporan Keuangan, dan Instruksi Pembayaran Pelanggan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sub-Label Hubungi Kami
                </label>
                <input
                  type="text"
                  value={form.contactBadge}
                  onChange={(e) => updateField('contactBadge', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Blok Hubungi Kami
                </label>
                <input
                  type="text"
                  value={form.contactTitle}
                  onChange={(e) => updateField('contactTitle', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Lengkap Dapur Sentral & Kantor
                </label>
                <input
                  type="text"
                  value={form.companyAddress}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp Tampilan (Format Baca)
                </label>
                <input
                  type="text"
                  value={form.whatsappDisplay}
                  onChange={(e) => updateField('whatsappDisplay', e.target.value)}
                  placeholder="0811-9823-401"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jam Operasional Layanan
                </label>
                <input
                  type="text"
                  value={form.operatingHours}
                  onChange={(e) => updateField('operatingHours', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-4 pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Rekening Bank Utama & Bank Kedua
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Bank Rekening Utama
                  </label>
                  <input
                    type="text"
                    value={form.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Rekening Utama
                  </label>
                  <input
                    type="text"
                    value={form.bankAccountNumber}
                    onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Atas Nama Rekening Utama
                  </label>
                  <input
                    type="text"
                    value={form.bankAccountHolder}
                    onChange={(e) => updateField('bankAccountHolder', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Bank Kedua (Opsional)
                  </label>
                  <input
                    type="text"
                    value={form.bank2Name || ''}
                    onChange={(e) => updateField('bank2Name', e.target.value)}
                    placeholder="Bank BCA / BRI"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Rekening Bank Kedua
                  </label>
                  <input
                    type="text"
                    value={form.bank2AccountNumber || ''}
                    onChange={(e) => updateField('bank2AccountNumber', e.target.value)}
                    placeholder="522-0394-881"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Atas Nama Rekening Kedua
                  </label>
                  <input
                    type="text"
                    value={form.bank2AccountHolder || ''}
                    onChange={(e) => updateField('bank2AccountHolder', e.target.value)}
                    placeholder="PT Smart Catering Nusantara"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <QrCode className="h-4 w-4 text-emerald-700" />
                <span>Pengaturan QRIS Usaha (Pembayaran Pelanggan)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Merchant QRIS
                  </label>
                  <input
                    type="text"
                    value={form.qrisMerchantName || ''}
                    onChange={(e) => updateField('qrisMerchantName', e.target.value)}
                    placeholder="SMART CATERING NUSANTARA"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NMID / ID Merchant QRIS
                  </label>
                  <input
                    type="text"
                    value={form.qrisNmid || ''}
                    onChange={(e) => updateField('qrisNmid', e.target.value)}
                    placeholder="ID102026098765432"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload Gambar QR QRIS atau URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.qrisImageUrl || ''}
                      onChange={(e) => updateField('qrisImageUrl', e.target.value)}
                      placeholder="URL gambar QRIS..."
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono text-slate-900"
                    />
                    <input
                      ref={qrisFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleQrisFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => qrisFileInputRef.current?.click()}
                      className="rounded-lg border border-slate-300 bg-white hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap"
                    >
                      Upload QR
                    </button>
                  </div>
                </div>
              </div>
              {form.qrisImageUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={form.qrisImageUrl}
                    alt="Pratinjau QRIS Usaha"
                    className="h-20 w-20 rounded-lg border border-slate-300 bg-white object-contain p-1"
                  />
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="font-semibold text-slate-800">Gambar QRIS Aktif</div>
                    <button
                      type="button"
                      onClick={() => updateField('qrisImageUrl', '')}
                      className="text-red-600 hover:underline font-semibold"
                    >
                      Hapus Gambar QR
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Save Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-600">
            Seluruh perubahan teks, judul, foto banner, dan kontak akan langsung tersimpan permanen di server.
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onPreviewCustomerStorefront}
              className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap"
            >
              Pratinjau Web Pelanggan
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-5 py-2.5 text-xs font-bold text-white transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>
                {saving ? 'Menyimpan Perubahan...' : 'Simpan Semua Perubahan Tampilan'}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
