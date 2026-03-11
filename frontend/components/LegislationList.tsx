'use client';

import { Text, VStack } from '@chakra-ui/react';
import LegislationCard from './LegislationCard';
import type { LegislationResponse } from '@/lib/types';
import { TEXT_PRIMARY, NEUTRAL_GRAY } from '@/lib/colors';

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
      <Text fontSize="md" fontWeight="semibold" color={TEXT_PRIMARY}>
        Legislation
      </Text>
      {legislationList.length === 0 ? (
        <Text fontSize="sm" color={NEUTRAL_GRAY}>
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
