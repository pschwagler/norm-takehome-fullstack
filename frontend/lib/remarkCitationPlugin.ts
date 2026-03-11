import type { Root, Text, PhrasingContent } from 'mdast';
import type { Plugin } from 'unified';
import { visit, SKIP } from 'unist-util-visit';

const CITATION_RE = /(\[\d+\])/g;

/**
 * Remark plugin that transforms [N] patterns in text nodes into custom
 * citationRef MDAST nodes, which are then rendered as clickable badges
 * by the component map. Skips code and inlineCode ancestors.
 */
const remarkCitationPlugin: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;

      // Skip citations inside code blocks
      if (parent.type === 'code' || parent.type === 'inlineCode') {
        return SKIP;
      }

      const value = node.value;
      if (!CITATION_RE.test(value)) return;

      // Reset regex state
      CITATION_RE.lastIndex = 0;

      const parts = value.split(CITATION_RE);
      if (parts.length <= 1) return;

      const newNodes: PhrasingContent[] = [];
      for (const part of parts) {
        const match = part.match(/^\[(\d+)\]$/);
        if (match) {
          newNodes.push({
            type: 'text',
            value: part,
            data: {
              hName: 'citation-ref',
              hProperties: { localRef: parseInt(match[1], 10) },
            },
          } as unknown as PhrasingContent);
        } else if (part) {
          newNodes.push({ type: 'text', value: part });
        }
      }

      parent.children.splice(index, 1, ...newNodes);
      return SKIP;
    });
  };
};

export default remarkCitationPlugin;
