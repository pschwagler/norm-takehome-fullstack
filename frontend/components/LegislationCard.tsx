'use client';

import { Flex, IconButton, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { MdDelete } from 'react-icons/md';
import type { LegislationResponse } from '@/lib/types';
import {
  BRAND_PURPLE,
  BORDER,
  HOVER_PURPLE,
  NEUTRAL_GRAY,
  TEXT_PRIMARY,
} from '@/lib/colors';
import { formatDate } from '@/lib/dates';

interface LegislationCardProps {
  legislation: LegislationResponse;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function LegislationCard({
  legislation,
  isSelected,
  onSelect,
  onDelete,
}: LegislationCardProps): React.ReactNode {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      px={4}
      py={3}
      border="1px solid"
      borderColor={isSelected ? BRAND_PURPLE : BORDER}
      borderRadius="md"
      bg={isSelected ? HOVER_PURPLE : 'white'}
      cursor="pointer"
      _hover={{ borderColor: BRAND_PURPLE }}
      align="center"
      justify="space-between"
      onClick={() => onSelect(legislation.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition="all 0.15s"
    >
      <Flex gap={4} align="center" flex={1} minW={0}>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color={isSelected ? BRAND_PURPLE : TEXT_PRIMARY}
          noOfLines={1}
        >
          {legislation.name}
        </Text>
        <Text fontSize="xs" color={NEUTRAL_GRAY} whiteSpace="nowrap">
          {legislation.laws_count} laws
        </Text>
        <Text fontSize="xs" color={NEUTRAL_GRAY} whiteSpace="nowrap">
          uploaded {formatDate(legislation.uploaded_at)}
        </Text>
      </Flex>
      {isHovered && (
        <IconButton
          aria-label="Delete legislation"
          icon={<MdDelete />}
          variant="ghost"
          size="sm"
          color={NEUTRAL_GRAY}
          _hover={{ color: 'red.500' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(legislation.id);
          }}
        />
      )}
    </Flex>
  );
}
