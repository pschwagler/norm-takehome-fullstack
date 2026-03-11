'use client';

import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import CitationCard from './CitationCard';
import type { CumulativeCitation } from '@/lib/types';
import { BRAND_PURPLE, BG, BORDER, TEXT_PRIMARY } from '@/lib/colors';

interface CitationDrawerProps {
  citations: CumulativeCitation[];
  isOpen: boolean;
  onToggle: () => void;
  highlightedIndex: number | null;
}

export default function CitationDrawer({
  citations,
  isOpen,
  onToggle,
  highlightedIndex,
}: CitationDrawerProps): React.ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedIndex === null || !scrollRef.current) return;

    const el = scrollRef.current.querySelector(
      `[data-citation-index="${highlightedIndex}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedIndex]);

  if (citations.length === 0) return null;

  return (
    <Flex direction="row" h="full">
      <Flex
        direction="column"
        align="center"
        justify="flex-start"
        pt={4}
        cursor="pointer"
        onClick={onToggle}
        borderLeft="1px solid"
        borderColor={BORDER}
        bg={BG}
        _hover={{ bg: '#F5F5F5' }}
        transition="background 0.15s"
        px={2}
        flexShrink={0}
      >
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color={BRAND_PURPLE}
          sx={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
          }}
          whiteSpace="nowrap"
        >
          Citations ({citations.length})
        </Text>
      </Flex>
      <Box
        width={isOpen ? { base: '340px', lg: '420px', xl: '500px' } : '0px'}
        minWidth={isOpen ? { base: '340px', lg: '420px', xl: '500px' } : '0px'}
        overflow="hidden"
        transition="width 0.2s, min-width 0.2s"
        borderLeft={isOpen ? '1px solid' : 'none'}
        borderColor={BORDER}
        bg={BG}
        h="full"
      >
        <Flex direction="column" h="full">
          <Flex
            px={4}
            py={3}
            borderBottom="1px solid"
            borderColor={BORDER}
            align="center"
            justify="space-between"
            flexShrink={0}
          >
            <Text fontSize="sm" fontWeight="semibold" color={TEXT_PRIMARY}>
              Citations ({citations.length})
            </Text>
          </Flex>
          <Box ref={scrollRef} flex={1} overflowY="auto" px={4} py={3}>
            <VStack spacing={2} align="stretch">
              {citations.map((c) => (
                <Box key={c.globalIndex} data-citation-index={c.globalIndex}>
                  <CitationCard
                    citation={c.citation}
                    globalIndex={c.globalIndex}
                    id={`citation-${c.globalIndex}`}
                    isHighlighted={highlightedIndex === c.globalIndex}
                  />
                </Box>
              ))}
            </VStack>
          </Box>
        </Flex>
      </Box>
    </Flex>
  );
}
