import { describe, expect, it } from 'vitest';
import { canMoveSegment, decideFsEvent, versionChanged } from './sync.js';

const base = { currentSlug: 'guide', baseHash: 'aaa', dirty: false };

describe('decideFsEvent', () => {
  it('refetches everything when the event carries no slug', () => {
    expect(decideFsEvent({}, base)).toBe('refetch-all');
    expect(decideFsEvent({ hash: 'zzz' }, { ...base, dirty: true })).toBe('refetch-all');
  });

  it('refreshes only the list for another slug', () => {
    expect(decideFsEvent({ slug: 'other', hash: 'zzz' }, base)).toBe('refresh-list');
    expect(decideFsEvent({ slug: 'other' }, { ...base, dirty: true })).toBe('refresh-list');
  });

  it('refreshes only the list when no doc is open', () => {
    expect(decideFsEvent({ slug: 'guide' }, { ...base, currentSlug: null })).toBe('refresh-list');
  });

  it('ignores its own save echo (hash === baseHash), even when dirty again', () => {
    expect(decideFsEvent({ slug: 'guide', hash: 'aaa' }, base)).toBe('ignore-echo');
    expect(decideFsEvent({ slug: 'guide', hash: 'aaa' }, { ...base, dirty: true })).toBe(
      'ignore-echo',
    );
  });

  it('silently refetches a clean open doc changed by someone else', () => {
    expect(decideFsEvent({ slug: 'guide', hash: 'bbb' }, base)).toBe('silent-refetch');
    // No hash on the event → cannot prove it is an echo → still refetch.
    expect(decideFsEvent({ slug: 'guide' }, base)).toBe('silent-refetch');
  });

  it('flags a conflict when the open doc is dirty and the change is foreign', () => {
    expect(decideFsEvent({ slug: 'guide', hash: 'bbb' }, { ...base, dirty: true })).toBe(
      'conflict',
    );
    expect(decideFsEvent({ slug: 'guide' }, { ...base, dirty: true })).toBe('conflict');
  });
});

describe('canMoveSegment (meta lock)', () => {
  const kinds = ['meta', 'markdown', 'callout', 'sequence'];

  it('the meta cover itself never moves', () => {
    expect(canMoveSegment(kinds, 0, 2)).toBe(false);
    expect(canMoveSegment(kinds, 0, 4)).toBe(false);
  });

  it('nothing moves above the meta cover (gap 0)', () => {
    expect(canMoveSegment(kinds, 2, 0)).toBe(false);
    expect(canMoveSegment(kinds, 3, 0)).toBe(false);
  });

  it('normal moves below the cover are allowed', () => {
    expect(canMoveSegment(kinds, 2, 1)).toBe(true);
    expect(canMoveSegment(kinds, 1, 3)).toBe(true);
    expect(canMoveSegment(kinds, 3, 1)).toBe(true);
  });

  it('gap 0 is a valid target when there is no meta cover', () => {
    expect(canMoveSegment(['markdown', 'callout'], 1, 0)).toBe(true);
  });

  it('rejects no-op moves and out-of-range indices', () => {
    expect(canMoveSegment(kinds, 2, 2)).toBe(false);
    expect(canMoveSegment(kinds, 2, 3)).toBe(false);
    expect(canMoveSegment(kinds, -1, 1)).toBe(false);
    expect(canMoveSegment(kinds, 4, 1)).toBe(false);
    expect(canMoveSegment(kinds, 1, 5)).toBe(false);
  });
});

describe('versionChanged (stale-tab guard)', () => {
  it('flags a real version change', () => {
    expect(versionChanged('0.1.0', '0.2.0')).toBe(true);
  });

  it('same version → no prompt', () => {
    expect(versionChanged('0.1.0', '0.1.0')).toBe(false);
  });

  it('unknown on either side → never prompt', () => {
    expect(versionChanged(null, '0.2.0')).toBe(false);
    expect(versionChanged('', '0.2.0')).toBe(false);
    expect(versionChanged('0.1.0', null)).toBe(false);
    expect(versionChanged('0.1.0', '')).toBe(false);
  });
});
