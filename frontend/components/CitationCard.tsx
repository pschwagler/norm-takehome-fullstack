'use client';

import { Box, Flex, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { Citation } from '@/lib/types';
import {
  BRAND_PURPLE,
  BORDER,
  HOVER_PURPLE,
  NEUTRAL_GRAY,
  TEXT_PRIMARY,
} from '@/lib/colors';

interface CitationCardProps {
  citation: Citation;
  globalIndex: number;
  id?: string;
  isHighlighted?: boolean;
}

export default function CitationCard({
  citation,
  globalIndex,
  id,
  isHighlighted = false,
}: CitationCardProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box
      id={id}
      borderRadius="md"
      border="1px solid"
      borderColor={isHighlighted ? BRAND_PURPLE : BORDER}
      bg="white"
      cursor="pointer"
      onClick={() => setIsExpanded(!isExpanded)}
      transition="all 0.3s"
      boxShadow={
        isHighlighted
          ? `0 0 0 2px ${HOVER_PURPLE}, 0 0 8px ${BRAND_PURPLE}40`
          : 'none'
      }
      _hover={{ borderColor: BRAND_PURPLE }}
    >
      <Box
        borderLeft={`3px solid ${BRAND_PURPLE}`}
        borderRadius="md"
        px={4}
        py={3}
      >
        <Flex justify="space-between" align="center" gap={2}>
          <Box flex={1} minW={0}>
            <Flex gap={2} align="baseline">
              <Text
                fontSize="sm"
                fontWeight="bold"
                color={BRAND_PURPLE}
                whiteSpace="nowrap"
              >
                [{globalIndex + 1}] Section {citation.source}
              </Text>
            </Flex>
            <Flex gap={1} align="baseline" mt={0.5}>
              {citation.legislation_name && (
                <Text fontSize="xs" color={NEUTRAL_GRAY} noOfLines={1}>
                  {citation.legislation_name}
                </Text>
              )}
              {citation.legislation_name && citation.jurisdiction && (
                <Text fontSize="xs" color={NEUTRAL_GRAY}>
                  |
                </Text>
              )}
              {citation.jurisdiction && (
                <Text fontSize="xs" color={NEUTRAL_GRAY} whiteSpace="nowrap">
                  {citation.jurisdiction}
                </Text>
              )}
            </Flex>
          </Box>
          <Text fontSize="xs" color={NEUTRAL_GRAY}>
            {isExpanded ? 'Collapse' : 'Expand'}
          </Text>
        </Flex>
        <Text
          fontSize="sm"
          color={TEXT_PRIMARY}
          mt={1}
          noOfLines={isExpanded ? undefined : 2}
        >
          {citation.text}
        </Text>
      </Box>
    </Box>
  );
}
