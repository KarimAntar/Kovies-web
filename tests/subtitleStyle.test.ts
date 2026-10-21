import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SUBTITLE_STYLE,
  normalizeSubtitleStyle,
  loadSubtitleStyle,
  saveSubtitleStyle,
  subtitleCss,
  subtitleLiftVh,
  type SubtitleStyle
} from '../src/lib/subtitleStyle.ts';

describe('subtitleStyle', () => {
  it('defaults match current look', () => {
    assert.deepEqual(DEFAULT_SUBTITLE_STYLE, {
      size: 'M',
      font: 'INTER',
      color: 'WHITE',
      edge: 'SHADOW',
      background: 0,
      position: 0
    });
  });

  it('normalize with garbage falls back per-field', () => {
    assert.deepEqual(normalizeSubtitleStyle(null), DEFAULT_SUBTITLE_STYLE);
    assert.deepEqual(normalizeSubtitleStyle('x'), DEFAULT_SUBTITLE_STYLE);
    assert.deepEqual(normalizeSubtitleStyle({ size: 'XXL', color: 'CYAN' }), {
      size: 'M',
      font: 'INTER',
      color: 'CYAN',
      edge: 'SHADOW',
      background: 0,
      position: 0
    });
  });

  it('normalize snaps background and clamps position', () => {
    const s = normalizeSubtitleStyle({ background: 0.6, position: 9 });
    assert.equal(s.background, 0.5);
    assert.equal(s.position, 4);

    const sLow = normalizeSubtitleStyle({ background: -1, position: -10 });
    assert.equal(sLow.background, 0);
    assert.equal(sLow.position, -2);
  });

  it('subtitleCss for OUTLINE and YELLOW+background .5', () => {
    const outline = subtitleCss({
      ...DEFAULT_SUBTITLE_STYLE,
      edge: 'OUTLINE'
    });
    assert.equal(
      outline.textShadow,
      '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000'
    );

    const yellowHalf = subtitleCss({
      ...DEFAULT_SUBTITLE_STYLE,
      color: 'YELLOW',
      background: 0.5
    });
    assert.equal(yellowHalf.color, '#FFE14D');
    assert.equal(yellowHalf.backgroundColor, 'rgba(0,0,0,0.5)');
    assert.equal(yellowHalf.padding, '0.2em 0.5em');
    assert.equal(yellowHalf.borderRadius, '0.25rem');

    const zeroBg = subtitleCss(DEFAULT_SUBTITLE_STYLE);
    assert.equal(zeroBg.backgroundColor, undefined);
    assert.equal(zeroBg.padding, undefined);
  });

  it('subtitleLiftVh multiplies position by 2', () => {
    assert.equal(subtitleLiftVh({ ...DEFAULT_SUBTITLE_STYLE, position: 4 }), 8);
    assert.equal(subtitleLiftVh({ ...DEFAULT_SUBTITLE_STYLE, position: -2 }), -4);
  });

  it('loadSubtitleStyle returns defaults when localStorage throws', () => {
    const origStorage = globalThis.localStorage;
    try {
      // @ts-ignore
      globalThis.localStorage = {
        getItem: () => {
          throw new Error('Blocked');
        },
        setItem: () => {}
      };
      assert.deepEqual(loadSubtitleStyle(), DEFAULT_SUBTITLE_STYLE);
    } finally {
      // @ts-ignore
      globalThis.localStorage = origStorage;
    }
  });

  it('saveSubtitleStyle round-trips via localStorage', () => {
    const mem: Record<string, string> = {};
    const origStorage = globalThis.localStorage;
    try {
      // @ts-ignore
      globalThis.localStorage = {
        getItem: (k: string) => mem[k] ?? null,
        setItem: (k: string, v: string) => {
          mem[k] = v;
        }
      };
      const custom: SubtitleStyle = {
        size: 'XL',
        font: 'MANROPE',
        color: 'CYAN',
        edge: 'RAISED',
        background: 0.75,
        position: 3
      };
      saveSubtitleStyle(custom);
      assert.deepEqual(loadSubtitleStyle(), custom);
    } finally {
      // @ts-ignore
      globalThis.localStorage = origStorage;
    }
  });
});
