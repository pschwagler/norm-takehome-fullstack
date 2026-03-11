import { describe, it, expect } from 'vitest';
import { buildCitationIndex } from '@/lib/citations';
import type { ActiveMessage, Citation } from '@/lib/types';

function makeCitation(
  source: string,
  text = 'text',
  legislation_id?: number
): Citation {
  return { source, text, legislation_id };
}

function makeMsg(
  role: 'user' | 'assistant',
  content: string,
  citations: Citation[] = []
): ActiveMessage {
  return { role, content, citations, isStreaming: false };
}

describe('buildCitationIndex', () => {
  it('returns empty for no messages', () => {
    const idx = buildCitationIndex([]);
    expect(idx.unique).toEqual([]);
  });

  it('returns empty when no assistant messages have citations', () => {
    const messages = [
      makeMsg('user', 'hello'),
      makeMsg('assistant', 'hi there'),
    ];
    const idx = buildCitationIndex(messages);
    expect(idx.unique).toEqual([]);
  });

  it('assigns sequential global indices across a single message', () => {
    const c1 = makeCitation('1.1', 'text', 1);
    const c2 = makeCitation('1.2', 'text', 1);
    const messages = [
      makeMsg('user', 'q'),
      makeMsg('assistant', 'a', [c1, c2]),
    ];

    const idx = buildCitationIndex(messages);
    expect(idx.unique).toEqual([
      { globalIndex: 0, citation: c1, messageIndex: 1 },
      { globalIndex: 1, citation: c2, messageIndex: 1 },
    ]);
  });

  it('assigns sequential global indices across multiple messages', () => {
    const c1 = makeCitation('1.1', 'text', 1);
    const c2 = makeCitation('1.2', 'text', 1);
    const c3 = makeCitation('2.1', 'text', 1);
    const messages = [
      makeMsg('user', 'q1'),
      makeMsg('assistant', 'a1', [c1, c2]),
      makeMsg('user', 'q2'),
      makeMsg('assistant', 'a2', [c3]),
    ];

    const idx = buildCitationIndex(messages);
    expect(idx.unique).toHaveLength(3);
    expect(idx.unique[0]).toEqual({
      globalIndex: 0,
      citation: c1,
      messageIndex: 1,
    });
    expect(idx.unique[2]).toEqual({
      globalIndex: 2,
      citation: c3,
      messageIndex: 3,
    });
  });

  it('skips user messages', () => {
    const messages = [
      makeMsg('user', 'q1'),
      makeMsg('user', 'q2'),
      makeMsg('assistant', 'a', [makeCitation('1.1', 'text', 1)]),
    ];

    const idx = buildCitationIndex(messages);
    expect(idx.unique).toHaveLength(1);
    expect(idx.unique[0].messageIndex).toBe(2);
  });

  it('deduplicates same citation across messages', () => {
    const c1 = makeCitation('1.1', 'text A', 3);
    const c2 = makeCitation('1.1', 'text A again', 3);
    const messages = [
      makeMsg('user', 'q1'),
      makeMsg('assistant', 'a1', [c1]),
      makeMsg('user', 'q2'),
      makeMsg('assistant', 'a2', [c2]),
    ];

    const idx = buildCitationIndex(messages);
    // Same (legislation_id, source) -> same globalIndex
    expect(idx.unique).toHaveLength(1);
    expect(idx.unique[0].globalIndex).toBe(0);
    // Both messages map to the same global index
    expect(idx.localToGlobal(1, 0)).toBe(0);
    expect(idx.localToGlobal(3, 0)).toBe(0);
  });

  it('distinguishes same section from different legislation', () => {
    const cA = makeCitation('1.1', 'text A', 1);
    const cB = makeCitation('1.1', 'text B', 2);
    const messages = [
      makeMsg('user', 'q'),
      makeMsg('assistant', 'a', [cA, cB]),
    ];

    const idx = buildCitationIndex(messages);
    expect(idx.unique).toHaveLength(2);
    expect(idx.unique[0].citation.legislation_id).toBe(1);
    expect(idx.unique[1].citation.legislation_id).toBe(2);
  });

  it('localToGlobal maps correctly for deduplicated citations', () => {
    const c1 = makeCitation('1.1', 'text', 1);
    const c2 = makeCitation('2.1', 'text', 1);
    const c3 = makeCitation('1.1', 'text', 1); // duplicate of c1
    const messages = [
      makeMsg('user', 'q1'),
      makeMsg('assistant', 'a1', [c1, c2]),
      makeMsg('user', 'q2'),
      makeMsg('assistant', 'a2', [c3]),
    ];

    const idx = buildCitationIndex(messages);
    // msg1: [1.1 -> 0, 2.1 -> 1]
    expect(idx.localToGlobal(1, 0)).toBe(0);
    expect(idx.localToGlobal(1, 1)).toBe(1);
    // msg3: [1.1 -> 0 (deduplicated)]
    expect(idx.localToGlobal(3, 0)).toBe(0);
  });

  it('localToGlobal falls back to localIndex for unknown messages', () => {
    const idx = buildCitationIndex([]);
    expect(idx.localToGlobal(99, 3)).toBe(3);
  });

  it('handles citations without legislation_id', () => {
    const c1 = makeCitation('1.1', 'text');
    const c2 = makeCitation('1.1', 'text');
    const messages = [
      makeMsg('user', 'q1'),
      makeMsg('assistant', 'a1', [c1]),
      makeMsg('user', 'q2'),
      makeMsg('assistant', 'a2', [c2]),
    ];

    const idx = buildCitationIndex(messages);
    // Both have undefined legislation_id -> same key ":1.1"
    expect(idx.unique).toHaveLength(1);
  });
});
