'use client';

import {
  Box,
  Code,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from '@chakra-ui/react';
import { createContext, useContext } from 'react';
import type { Components } from 'react-markdown';
import {
  BRAND_PURPLE,
  HOVER_PURPLE,
  BORDER,
  TEXT_PRIMARY,
} from '@/lib/colors';

interface CitationContextValue {
  localToGlobal: (localCitationIndex: number) => number;
  onCitationClick?: (globalIndex: number) => void;
}

export const CitationContext = createContext<CitationContextValue>({
  localToGlobal: (i) => i,
});

function CitationBadge({ localRef }: { localRef: number }): React.ReactNode {
  const { localToGlobal, onCitationClick } = useContext(CitationContext);
  const globalIndex = localToGlobal(localRef - 1);

  if (typeof globalIndex !== 'number' || isNaN(globalIndex)) {
    return null;
  }

  return (
    <Text
      as="span"
      color={BRAND_PURPLE}
      fontWeight="semibold"
      cursor="pointer"
      _hover={{ textDecoration: 'underline' }}
      onClick={() => onCitationClick?.(globalIndex)}
    >
      [{globalIndex + 1}]
    </Text>
  );
}

export const MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => (
    <Text lineHeight="1.7" mb={2} color={TEXT_PRIMARY}>
      {children}
    </Text>
  ),

  h1: ({ children }) => (
    <Text fontSize="xl" fontWeight="bold" mt={4} mb={2} color={TEXT_PRIMARY}>
      {children}
    </Text>
  ),

  h2: ({ children }) => (
    <Text fontSize="lg" fontWeight="bold" mt={3} mb={2} color={TEXT_PRIMARY}>
      {children}
    </Text>
  ),

  h3: ({ children }) => (
    <Text fontSize="md" fontWeight="bold" mt={3} mb={1} color={TEXT_PRIMARY}>
      {children}
    </Text>
  ),

  ul: ({ children }) => (
    <UnorderedList pl={4} mb={2} spacing={1}>
      {children}
    </UnorderedList>
  ),

  ol: ({ children }) => (
    <OrderedList pl={4} mb={2} spacing={1}>
      {children}
    </OrderedList>
  ),

  li: ({ children }) => (
    <ListItem lineHeight="1.7" color={TEXT_PRIMARY}>
      {children}
    </ListItem>
  ),

  strong: ({ children }) => (
    <Text as="strong" fontWeight="bold">
      {children}
    </Text>
  ),

  em: ({ children }) => <Text as="em">{children}</Text>,

  code: ({ children, className }) => {
    // Block code (inside <pre>) gets className from remark
    const isBlock = !!className;
    if (isBlock) {
      return (
        <Code display="block" whiteSpace="pre" p={3} fontSize="sm">
          {children}
        </Code>
      );
    }
    return (
      <Code bg={HOVER_PURPLE} color={TEXT_PRIMARY} px={1} borderRadius="sm">
        {children}
      </Code>
    );
  },

  pre: ({ children }) => (
    <Box
      as="pre"
      border="1px solid"
      borderColor={BORDER}
      borderRadius="md"
      overflow="auto"
      my={2}
    >
      {children}
    </Box>
  ),

  blockquote: ({ children }) => (
    <Box
      borderLeft="3px solid"
      borderColor={BRAND_PURPLE}
      pl={4}
      my={2}
      opacity={0.85}
    >
      {children}
    </Box>
  ),

  // Custom element produced by remarkCitationPlugin
  'citation-ref': (({
    localRef,
  }: {
    localRef: number;
  }) => {
    return <CitationBadge localRef={localRef} />;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,
};
