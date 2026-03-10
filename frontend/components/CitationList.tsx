'use client';

import { Text, VStack } from '@chakra-ui/react';
import CitationCard from './CitationCard';
import type { Citation } from '@/lib/types';

interface CitationListProps {
  citations: Citation[];
}

export default function CitationList({
  citations,
}: CitationListProps): React.ReactNode {
  if (citations.length === 0) return null;

  return (
    <VStack align="stretch" spacing={2} w="full">
      <Text fontSize="sm" fontWeight="semibold" color="#5E6272">
        Citations
      </Text>
      {citations.map((c, i) => (
        <CitationCard key={`${c.source}-${i}`} citation={c} index={i} />
      ))}
    </VStack>
  );
}
