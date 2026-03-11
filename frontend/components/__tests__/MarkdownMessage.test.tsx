import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCitationPlugin from '@/lib/remarkCitationPlugin';
import {
  CitationContext,
  MARKDOWN_COMPONENTS,
} from '@/components/MarkdownComponents';

const REMARK_PLUGINS = [remarkGfm, remarkCitationPlugin];

function renderMarkdown(
  content: string,
  opts: {
    localToGlobal?: (i: number) => number;
    onCitationClick?: (i: number) => void;
  } = {}
) {
  const localToGlobal = opts.localToGlobal ?? ((i) => i);
  const onCitationClick = opts.onCitationClick;

  return render(
    <ChakraProvider>
      <CitationContext.Provider value={{ localToGlobal, onCitationClick }}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          components={MARKDOWN_COMPONENTS}
        >
          {content}
        </ReactMarkdown>
      </CitationContext.Provider>
    </ChakraProvider>
  );
}

describe('Markdown rendering', () => {
  it('renders bold text', () => {
    renderMarkdown('This is **bold** text');
    expect(screen.getByText('bold')).toHaveStyle('font-weight: bold');
  });

  it('renders headings', () => {
    renderMarkdown('### A Heading');
    expect(screen.getByText('A Heading')).toBeInTheDocument();
  });

  it('renders unordered lists', () => {
    renderMarkdown('- Item one\n- Item two');
    expect(screen.getByText('Item one')).toBeInTheDocument();
    expect(screen.getByText('Item two')).toBeInTheDocument();
  });

  it('renders inline code', () => {
    renderMarkdown('Use `myFunction()` here');
    const code = screen.getByText('myFunction()');
    expect(code.tagName).toBe('CODE');
  });

  it('renders ordered lists', () => {
    renderMarkdown('1. First\n2. Second');
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders blockquotes', () => {
    renderMarkdown('> Important note');
    expect(screen.getByText('Important note')).toBeInTheDocument();
  });
});

describe('Citation integration', () => {
  it('renders [1] as a clickable badge with correct global index', () => {
    renderMarkdown('See source [1] for details', {
      localToGlobal: () => 0,
    });
    expect(screen.getByText('[1]')).toBeInTheDocument();
  });

  it('maps [2] through localToGlobal correctly', () => {
    renderMarkdown('Reference [2] here', {
      localToGlobal: (i) => i + 5,
    });
    // localRef=2, so localToGlobal(1) = 6, display = [7]
    expect(screen.getByText('[7]')).toBeInTheDocument();
  });

  it('calls onCitationClick with globalIndex on click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderMarkdown('Click [1] here', {
      localToGlobal: () => 3,
      onCitationClick: onClick,
    });
    await user.click(screen.getByText('[4]'));
    expect(onClick).toHaveBeenCalledWith(3);
  });

  it('does NOT treat [1] inside inline code as a citation', () => {
    renderMarkdown('Use `array[1]` for access');
    // The [1] should appear as part of code, not as a citation badge
    const code = screen.getByText('array[1]');
    expect(code.tagName).toBe('CODE');
  });

  it('does NOT treat [1] inside fenced code block as a citation', () => {
    renderMarkdown('```\narray[1]\n```');
    expect(screen.getByText('array[1]')).toBeInTheDocument();
  });

  it('renders multiple citations in the same paragraph', () => {
    renderMarkdown('See [1] and [2] for details', {
      localToGlobal: (i) => i,
    });
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('[2]')).toBeInTheDocument();
  });
});
