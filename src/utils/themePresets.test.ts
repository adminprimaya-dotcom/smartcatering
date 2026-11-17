import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BOTANICAL_ORNAMENT_URL,
  getThemeCssVariables,
  resolveOrnamentConfig,
  resolveThemePreset,
  THEME_LIST,
} from './themePresets';

test('resolveThemePreset returns Flora Nusantara Elegan for flora-elegan or unknown key', () => {
  const flora = resolveThemePreset('flora-elegan');
  assert.equal(flora.key, 'flora-elegan');
  assert.equal(flora.supportsOrnament, true);
  assert.equal(flora.useSerifDisplay, true);

  const fallback = resolveThemePreset('unknown-theme');
  assert.equal(fallback.key, 'flora-elegan');
});

test('resolveThemePreset resolves all registered themes accurately', () => {
  assert.equal(THEME_LIST.length, 5);
  assert.equal(resolveThemePreset('emerald').key, 'emerald');
  assert.equal(resolveThemePreset('navy').key, 'navy');
  assert.equal(resolveThemePreset('teal').key, 'teal');
  assert.equal(resolveThemePreset('amber').key, 'amber');
});

test('resolveOrnamentConfig enables attached floral artwork by default for flora-elegan and honors toggles', () => {
  const autoFlora = resolveOrnamentConfig({ accentTheme: 'flora-elegan' });
  assert.equal(autoFlora.enabled, true);
  assert.equal(autoFlora.imageUrl, DEFAULT_BOTANICAL_ORNAMENT_URL);

  const disabledFlora = resolveOrnamentConfig({
    accentTheme: 'flora-elegan',
    themeOrnamentEnabled: false,
  });
  assert.equal(disabledFlora.enabled, false);

  const customOnEmerald = resolveOrnamentConfig({
    accentTheme: 'emerald',
    themeOrnamentEnabled: true,
    themeOrnamentUrl: '/custom/ornament.png',
  });
  assert.equal(customOnEmerald.enabled, true);
  assert.equal(customOnEmerald.imageUrl, '/custom/ornament.png');
});

test('getThemeCssVariables returns valid semantic CSS custom properties', () => {
  const vars = getThemeCssVariables('flora-elegan');
  assert.equal(vars['--theme-hero-bg'], '#0F2634');
  assert.equal(vars['--theme-primary'], '#C43E24');
  assert.equal(vars['--theme-secondary'], '#1A6D7E');
  assert.equal(vars['--theme-canvas'], '#FAF7F2');
});
