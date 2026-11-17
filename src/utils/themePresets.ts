import { SiteContentSettings } from '../types/erp';

export type ThemeKey = SiteContentSettings['accentTheme'];

export const DEFAULT_BOTANICAL_ORNAMENT_URL = '/assets/aistudio/image_aa6f6a24.png';

export interface ThemePreset {
  key: ThemeKey;
  name: string;
  tagline: string;
  description: string;
  swatches: [string, string, string, string];
  supportsOrnament: boolean;
  useSerifDisplay: boolean;
  pageBgClass: string;
  headerClass: string;
  headerTopStripStyle: string;
  navHoverClass: string;
  heroSectionClass: string;
  heroDividerClass: string;
  heroStepAccentClasses: [string, string, string];
  heroImageFrameClass: string;
  primaryBtnClass: string;
  secondaryHeroBtnClass: string;
  accentTextLightClass: string;
  accentTextDarkClass: string;
  activeTabClass: string;
  cardBorderClass: string;
  softPanelClass: string;
  contactCardClass: string;
  sidebarBgClass: string;
  sidebarActiveClass: string;
  sidebarIconClass: string;
  footerClass: string;
  cssVars: {
    canvas: string;
    surface: string;
    border: string;
    heroBg: string;
    primary: string;
    primaryHover: string;
    secondary: string;
    warm: string;
  };
}

export const THEME_PRESETS: Record<ThemeKey, ThemePreset> = {
  'flora-elegan': {
    key: 'flora-elegan',
    name: 'Flora Nusantara Elegan',
    tagline: 'Ornamen Botani Koral, Teal & Indigo',
    description:
      'Desain artistik eksklusif berhiaskan ilustrasi flora Nusantara dengan harmoni warna indigo merak, terakota koral, emas kunyit, dan kanvas gading.',
    swatches: ['#0F2634', '#C43E24', '#1A6D7E', '#F4A95B'],
    supportsOrnament: true,
    useSerifDisplay: true,
    pageBgClass: 'bg-[#FAF7F2] text-[#14232E]',
    headerClass: 'border-[#E6DDD0] bg-[#FFFFFF]/95 backdrop-blur-xs',
    headerTopStripStyle:
      'linear-gradient(90deg, #0F2634 0%, #1A6D7E 38%, #C43E24 72%, #E59B43 100%)',
    navHoverClass: 'hover:text-[#C43E24]',
    heroSectionClass: 'bg-[#0F2634] text-white border-b border-[#1E3B4D]',
    heroDividerClass: 'border-[#1E3D4F]',
    heroStepAccentClasses: ['text-[#7AD4E3]', 'text-[#F6B86C]', 'text-white'],
    heroImageFrameClass:
      'rounded-2xl bg-white p-2 shadow-2xl border border-[#F4A95B]/40',
    primaryBtnClass: 'bg-[#C43E24] hover:bg-[#A9331C] text-white',
    secondaryHeroBtnClass:
      'border border-[#365C70] bg-[#163648] hover:bg-[#1E475D] text-white',
    accentTextLightClass: 'text-[#1A6D7E]',
    accentTextDarkClass: 'text-[#F6B86C]',
    activeTabClass: 'bg-[#0F2634] text-white',
    cardBorderClass: 'border-[#E4DCD0]',
    softPanelClass: 'border-[#E7DFD3] bg-[#FBF8F3]',
    contactCardClass: 'border-[#1E3B4D] bg-[#0F2634] text-white',
    sidebarBgClass: 'bg-[#0F2634] border-[#1B3A4B]',
    sidebarActiveClass: 'bg-[#C43E24] text-white shadow-xs',
    sidebarIconClass: 'text-[#7AD4E3]',
    footerClass: 'border-[#E4DCD0] bg-white text-slate-600',
    cssVars: {
      canvas: '#FAF7F2',
      surface: '#FFFFFF',
      border: '#E4DCD0',
      heroBg: '#0F2634',
      primary: '#C43E24',
      primaryHover: '#A9331C',
      secondary: '#1A6D7E',
      warm: '#F4A95B',
    },
  },
  emerald: {
    key: 'emerald',
    name: 'Hijau Emerald Nusantara',
    tagline: 'Standar Profesional Segar & Bersih',
    description:
      'Tema korporat modern dengan dominasi putih bersih, biru-abu gelap, dan aksen hijau zamrud untuk tampilan kuliner yang higienis.',
    swatches: ['#0F172A', '#047857', '#10B981', '#F59E0B'],
    supportsOrnament: false,
    useSerifDisplay: false,
    pageBgClass: 'bg-slate-50 text-slate-900',
    headerClass: 'border-slate-200 bg-white/95 backdrop-blur-xs',
    headerTopStripStyle: 'linear-gradient(90deg, #0F172A 0%, #047857 100%)',
    navHoverClass: 'hover:text-emerald-700',
    heroSectionClass: 'bg-slate-900 text-white border-b border-slate-800',
    heroDividerClass: 'border-slate-800',
    heroStepAccentClasses: ['text-emerald-400', 'text-amber-300', 'text-white'],
    heroImageFrameClass: 'rounded-2xl overflow-hidden border border-slate-800 bg-slate-800',
    primaryBtnClass: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    secondaryHeroBtnClass:
      'border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white',
    accentTextLightClass: 'text-emerald-700',
    accentTextDarkClass: 'text-amber-300',
    activeTabClass: 'bg-slate-900 text-white',
    cardBorderClass: 'border-slate-200',
    softPanelClass: 'border-slate-200 bg-slate-50',
    contactCardClass: 'border-slate-200 bg-slate-900 text-white',
    sidebarBgClass: 'bg-slate-900 border-slate-800',
    sidebarActiveClass: 'bg-emerald-600 text-white shadow-xs',
    sidebarIconClass: 'text-emerald-400',
    footerClass: 'border-slate-200 bg-white text-slate-500',
    cssVars: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      heroBg: '#0F172A',
      primary: '#047857',
      primaryHover: '#065F46',
      secondary: '#0F766E',
      warm: '#F59E0B',
    },
  },
  navy: {
    key: 'navy',
    name: 'Biru Navy Eksekutif',
    tagline: 'Wibawa Korporat & Instansi',
    description:
      'Palet navy mendalam dengan aksen biru royal untuk layanan catering kementerian, konferensi korporat, dan acara resmi.',
    swatches: ['#0B1B36', '#1D4ED8', '#0284C7', '#EAB308'],
    supportsOrnament: false,
    useSerifDisplay: false,
    pageBgClass: 'bg-slate-50 text-slate-900',
    headerClass: 'border-slate-200 bg-white/95 backdrop-blur-xs',
    headerTopStripStyle: 'linear-gradient(90deg, #0B1B36 0%, #1D4ED8 100%)',
    navHoverClass: 'hover:text-blue-700',
    heroSectionClass: 'bg-[#0B1B36] text-white border-b border-blue-950',
    heroDividerClass: 'border-blue-900/60',
    heroStepAccentClasses: ['text-sky-300', 'text-amber-300', 'text-white'],
    heroImageFrameClass: 'rounded-2xl overflow-hidden border border-blue-900 bg-[#102549]',
    primaryBtnClass: 'bg-blue-700 hover:bg-blue-800 text-white',
    secondaryHeroBtnClass:
      'border border-blue-700/70 bg-[#122A52] hover:bg-[#19386B] text-white',
    accentTextLightClass: 'text-blue-700',
    accentTextDarkClass: 'text-sky-300',
    activeTabClass: 'bg-[#0B1B36] text-white',
    cardBorderClass: 'border-slate-200',
    softPanelClass: 'border-slate-200 bg-slate-50',
    contactCardClass: 'border-blue-950 bg-[#0B1B36] text-white',
    sidebarBgClass: 'bg-[#0B1B36] border-blue-950',
    sidebarActiveClass: 'bg-blue-700 text-white shadow-xs',
    sidebarIconClass: 'text-sky-300',
    footerClass: 'border-slate-200 bg-white text-slate-500',
    cssVars: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      border: '#E2E8F0',
      heroBg: '#0B1B36',
      primary: '#1D4ED8',
      primaryHover: '#1E40AF',
      secondary: '#0284C7',
      warm: '#FACC15',
    },
  },
  teal: {
    key: 'teal',
    name: 'Teal Modern & Segar',
    tagline: 'Harmoni Tropis Kontemporer',
    description:
      'Nuansa toska gelap yang menenangkan berpadu dengan kontras cerah untuk pengalaman pesan menu yang ramah dan ringan.',
    swatches: ['#0D2C33', '#0F766E', '#14B8A6', '#F59E0B'],
    supportsOrnament: false,
    useSerifDisplay: false,
    pageBgClass: 'bg-[#F3F8F8] text-slate-900',
    headerClass: 'border-teal-100 bg-white/95 backdrop-blur-xs',
    headerTopStripStyle: 'linear-gradient(90deg, #0D2C33 0%, #0F766E 100%)',
    navHoverClass: 'hover:text-teal-700',
    heroSectionClass: 'bg-[#0D2C33] text-white border-b border-teal-900',
    heroDividerClass: 'border-teal-800/70',
    heroStepAccentClasses: ['text-teal-300', 'text-amber-300', 'text-white'],
    heroImageFrameClass: 'rounded-2xl overflow-hidden border border-teal-800 bg-[#123A42]',
    primaryBtnClass: 'bg-teal-700 hover:bg-teal-800 text-white',
    secondaryHeroBtnClass:
      'border border-teal-700 bg-[#133D45] hover:bg-[#194E58] text-white',
    accentTextLightClass: 'text-teal-700',
    accentTextDarkClass: 'text-teal-300',
    activeTabClass: 'bg-[#0D2C33] text-white',
    cardBorderClass: 'border-teal-100',
    softPanelClass: 'border-teal-100 bg-[#F6FAFA]',
    contactCardClass: 'border-teal-900 bg-[#0D2C33] text-white',
    sidebarBgClass: 'bg-[#0D2C33] border-teal-950',
    sidebarActiveClass: 'bg-teal-600 text-white shadow-xs',
    sidebarIconClass: 'text-teal-300',
    footerClass: 'border-teal-100 bg-white text-slate-500',
    cssVars: {
      canvas: '#F3F8F8',
      surface: '#FFFFFF',
      border: '#CCFBF1',
      heroBg: '#0D2C33',
      primary: '#0F766E',
      primaryHover: '#115E59',
      secondary: '#14B8A6',
      warm: '#F59E0B',
    },
  },
  amber: {
    key: 'amber',
    name: 'Emas Royal & Hangat',
    tagline: 'Kemewahan Jamuan Pernikahan & Gala',
    description:
      'Palet cokelat espresso dan emas hangat yang menghadirkan nuansa prestisius untuk pesta pernikahan, tumpeng, dan jamuan istimewa.',
    swatches: ['#23170E', '#B45309', '#D97706', '#FDE68A'],
    supportsOrnament: false,
    useSerifDisplay: true,
    pageBgClass: 'bg-[#FAF7F2] text-stone-900',
    headerClass: 'border-stone-200 bg-white/95 backdrop-blur-xs',
    headerTopStripStyle: 'linear-gradient(90deg, #23170E 0%, #B45309 100%)',
    navHoverClass: 'hover:text-amber-700',
    heroSectionClass: 'bg-[#23170E] text-white border-b border-amber-950',
    heroDividerClass: 'border-amber-900/50',
    heroStepAccentClasses: ['text-amber-300', 'text-orange-300', 'text-white'],
    heroImageFrameClass: 'rounded-2xl overflow-hidden border border-amber-800/70 bg-[#322215]',
    primaryBtnClass: 'bg-amber-700 hover:bg-amber-800 text-white',
    secondaryHeroBtnClass:
      'border border-amber-800/80 bg-[#352315] hover:bg-[#462F1C] text-white',
    accentTextLightClass: 'text-amber-800',
    accentTextDarkClass: 'text-amber-300',
    activeTabClass: 'bg-[#23170E] text-white',
    cardBorderClass: 'border-stone-200',
    softPanelClass: 'border-stone-200 bg-[#FAF6F0]',
    contactCardClass: 'border-amber-950 bg-[#23170E] text-white',
    sidebarBgClass: 'bg-[#23170E] border-amber-950',
    sidebarActiveClass: 'bg-amber-700 text-white shadow-xs',
    sidebarIconClass: 'text-amber-300',
    footerClass: 'border-stone-200 bg-white text-stone-500',
    cssVars: {
      canvas: '#FAF7F2',
      surface: '#FFFFFF',
      border: '#E7E5E4',
      heroBg: '#23170E',
      primary: '#B45309',
      primaryHover: '#92400E',
      secondary: '#D97706',
      warm: '#FDE68A',
    },
  },
};

export const THEME_LIST: ThemePreset[] = [
  THEME_PRESETS['flora-elegan'],
  THEME_PRESETS.emerald,
  THEME_PRESETS.navy,
  THEME_PRESETS.teal,
  THEME_PRESETS.amber,
];

export function resolveThemePreset(themeKey?: string): ThemePreset {
  if (themeKey && themeKey in THEME_PRESETS) {
    return THEME_PRESETS[themeKey as ThemeKey];
  }
  return THEME_PRESETS['flora-elegan'];
}

export interface OrnamentConfig {
  enabled: boolean;
  imageUrl: string;
}

export function resolveOrnamentConfig(
  settings?: Partial<SiteContentSettings>
): OrnamentConfig {
  const preset = resolveThemePreset(settings?.accentTheme);
  const customUrl = (settings?.themeOrnamentUrl || '').trim();
  const explicitFlag = settings?.themeOrnamentEnabled;

  // Enable botanical ornament automatically when Flora Elegan is selected unless explicitly turned off,
  // or when Admin explicitly enables ornament on any theme.
  const enabled =
    explicitFlag !== undefined ? Boolean(explicitFlag) : preset.supportsOrnament;

  const imageUrl = customUrl || DEFAULT_BOTANICAL_ORNAMENT_URL;

  return {
    enabled,
    imageUrl,
  };
}

export function getThemeCssVariables(themeKey?: string): Record<string, string> {
  const preset = resolveThemePreset(themeKey);
  return {
    '--theme-canvas': preset.cssVars.canvas,
    '--theme-surface': preset.cssVars.surface,
    '--theme-border': preset.cssVars.border,
    '--theme-hero-bg': preset.cssVars.heroBg,
    '--theme-primary': preset.cssVars.primary,
    '--theme-primary-hover': preset.cssVars.primaryHover,
    '--theme-secondary': preset.cssVars.secondary,
    '--theme-warm': preset.cssVars.warm,
  };
}
