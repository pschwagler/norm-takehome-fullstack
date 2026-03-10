'use client';

import { Text, VStack } from '@chakra-ui/react';
import LegislationCard from './LegislationCard';
import type { LegislationResponse } from '@/lib/types';

interface LegislationListProps {
  legislationList: LegislationResponse[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function LegislationList({
  legislationList,
  selectedId,
  onSelect,
  onDelete,
}: LegislationListProps): React.ReactNode {
  return (
    <VStack align="stretch" spacing={2}>
      <Text fontSize="md" fontWeight="semibold" color="#32343C">
        Legislation
      </Text>
      {legislationList.length === 0 ? (
        <Text fontSize="sm" color="#5E6272">
          No legislation uploaded yet.
        </Text>
      ) : (
        legislationList.map((legislation) => (
          <LegislationCard
            key={legislation.id}
            legislation={legislation}
            isSelected={legislation.id === selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))
      )}
    </VStack>
  );
}
