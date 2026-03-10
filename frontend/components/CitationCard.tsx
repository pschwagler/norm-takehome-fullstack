'use client';

import { Box, Flex, Text } from '@chakra-ui/react';
import { useState } from 'react';
import type { Citation } from '@/lib/types';

interface CitationCardProps {
  citation: Citation;
  index: number;
}

export default function CitationCard({
  citation,
  index,
}: CitationCardProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box
      borderLeft="3px solid"
      borderLeftColor="#2800D7"
      borderRadius="md"
      border="1px solid"
      borderColor="#DBDCE1"
      bg="white"
      cursor="pointer"
      onClick={() => setIsExpanded(!isExpanded)}
      transition="all 0.15s"
      _hover={{ borderColor: '#2800D7' }}
    >
      <Box borderLeft="3px solid #2800D7" borderRadius="md" px={4} py={3}>
        <Flex justify="space-between" align="center" gap={2}>
          <Flex gap={2} align="baseline" flex={1} minW={0}>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color="#2800D7"
              whiteSpace="nowrap"
            >
              [{index + 1}] Section {citation.source}
            </Text>
            {citation.jurisdiction && (
              <Text fontSize="xs" color="#5E6272">
                {citation.jurisdiction}
              </Text>
            )}
          </Flex>
          <Text fontSize="xs" color="#5E6272">
            {isExpanded ? 'Collapse' : 'Expand'}
          </Text>
        </Flex>
        <Text
          fontSize="sm"
          color="#32343C"
          mt={1}
          noOfLines={isExpanded ? undefined : 2}
        >
          {citation.text}
        </Text>
      </Box>
    </Box>
  );
}
