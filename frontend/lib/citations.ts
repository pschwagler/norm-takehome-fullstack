import type { ActiveMessage, Citation, CumulativeCitation } from '@/lib/types';

/** Stable dedup key for a citation (legislation + section). */
function citationKey(c: Citation): string {
  return `${c.legislation_id ?? ''}:${c.source}`;
}

interface CitationIndex {
  unique: CumulativeCitation[];
  localToGlobal: (messageIndex: number, localCitationIndex: number) => number;
}

/**
 * Deduplicate citations across all assistant messages and assign each a
 * stable global index. Returns the unique list plus a `localToGlobal`
 * helper so components can translate a per-message citation position
 * into the global numbering used by the citation drawer.
 */
export function buildCitationIndex(messages: ActiveMessage[]): CitationIndex {
  const keyToGlobal = new Map<string, number>();
  const unique: CumulativeCitation[] = [];
  const perMessage = new Map<number, number[]>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    const globals: number[] = [];
    for (const citation of msg.citations) {
      const key = citationKey(citation);
      let gi = keyToGlobal.get(key);
      if (gi === undefined) {
        gi = unique.length;
        keyToGlobal.set(key, gi);
        unique.push({ globalIndex: gi, citation, messageIndex: i });
      }
      globals.push(gi);
    }
    perMessage.set(i, globals);
  }

  return {
    unique,
    localToGlobal: (messageIndex, localIndex) => {
      const arr = perMessage.get(messageIndex);
      return arr ? arr[localIndex] : localIndex;
    },
  };
}
