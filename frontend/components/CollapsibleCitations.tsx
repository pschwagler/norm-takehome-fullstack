'use client';

import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { MdExpandMore, MdExpandLess } from 'react-icons/md';
import CitationCard from './CitationCard';
import type { Citation } from '@/lib/types';

interface CollapsibleCitationsProps {
  citations: Citation[];
}

export default function CollapsibleCitations({
  citations,
}: CollapsibleCitationsProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  if (citations.length === 0) return null;

  return (
    <Box>
      <Flex
        align="center"
        gap={1}
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        py={1}
        _hover={{ opacity: 0.8 }}
      >
        <Text fontSize="sm" fontWeight="semibold" color="#5E6272">
          {citations.length} citation{citations.length !== 1 ? 's' : ''}
        </Text>
        <Box color="#5E6272">
          {isExpanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
        </Box>
      </Flex>
      <Box
        overflow="hidden"
        maxH={isExpanded ? '2000px' : '0px'}
        transition="max-height 0.3s ease-in-out"
      >
        <VStack align="stretch" spacing={2} pt={1}>
          {citations.map((c, i) => (
            <CitationCard key={`${c.source}-${i}`} citation={c} index={i} />
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
