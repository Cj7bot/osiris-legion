import { describe, it, expect } from 'vitest';
import { scoreRisk, findCoords, parseTelegramHTML } from './route';

describe('scoreRisk', () => {
  it('reports the terms that produced the score', () => {
    const r = scoreRisk('Missile strike reported near the frontline');
    expect(r.matched).toEqual(expect.arrayContaining(['missile', 'strike', 'frontline']));
    expect(r.score).toBe(1 + r.matched.length * 2);
  });

  it('scores unremarkable text at the floor', () => {
    expect(scoreRisk('Local council approves new library hours')).toEqual({ score: 1, matched: [] });
  });

  it('caps at 10 and stays deterministic', () => {
    const text = 'war missile strike attack nuclear invasion bomb drone killed destroyed';
    expect(scoreRisk(text).score).toBe(10);
    expect(scoreRisk(text)).toEqual(scoreRisk(text));
  });
});

describe('findCoords', () => {
  it('returns the preset anchor and names the term it matched', () => {
    expect(findCoords('Reports of shelling in Rafah, southern Gaza')).toEqual({
      coords: [31.416, 34.333], anchor: 'gaza',
    });
  });

  it('returns null when no place term is present', () => {
    expect(findCoords('Markets closed higher on Tuesday')).toBeNull();
  });

  /* The anchor is a territory centroid, so two different events in the same
     territory resolve to the same point. That is the limitation the payload's
     location_precision field exists to declare. */
  it('gives distinct events in one territory the same anchor', () => {
    expect(findCoords('strike in Rafah, Gaza')?.coords).toEqual(findCoords('aid convoy in Gaza City')?.coords);
  });
});

/* Trimmed from a real t.me/s/ page: one post, one service notice. */
const post = (inner: string, cls = 'tgme_widget_message text_not_supported_wrap js-widget_message') => `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="${cls}" data-post="ch/1">
<div class="tgme_widget_message_text js-message_text" dir="auto">${inner}</div>
<a class="tgme_widget_message_date" href="https://t.me/ch/1"><time datetime="2026-09-14T12:00:00+00:00" class="time">12:00</time></a>
</div>
</div>
</div>`;

describe('parseTelegramHTML', () => {
  it('tags every item with the channel and its declared lean', () => {
    const items = parseTelegramHTML(post('Missile strike reported near the frontline'), 'ch', 'Pro-Russian / Multipolar');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 't.me/ch', lean: 'Pro-Russian / Multipolar', link: 'https://t.me/ch/1' });
  });

  it('drops service notices such as pins and renames', () => {
    const html = post('Channel pinned a photo', 'tgme_widget_message text_not_supported_wrap service_message js-widget_message')
      + post('Real report from the ground, with detail');
    const items = parseTelegramHTML(html, 'ch', 'x');
    expect(items.map(i => i.title)).toEqual(['Real report from the ground, with detail']);
  });
});
