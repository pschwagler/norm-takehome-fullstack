'use client';

import { Flex, IconButton, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { MdDelete } from 'react-icons/md';
import type { DocumentResponse } from '@/lib/types';

interface DocumentCardProps {
  document: DocumentResponse;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DocumentCard({
  document,
  isSelected,
  onSelect,
  onDelete,
}: DocumentCardProps): React.ReactNode {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      px={4}
      py={3}
      border="1px solid"
      borderColor={isSelected ? '#2800D7' : '#DBDCE1'}
      borderRadius="md"
      bg={isSelected ? '#EEEBFF' : 'white'}
      cursor="pointer"
      _hover={{ borderColor: '#2800D7' }}
      align="center"
      justify="space-between"
      onClick={() => onSelect(document.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition="all 0.15s"
    >
      <Flex gap={4} align="center" flex={1} minW={0}>
        <Text
          fontSize="sm"
          fontWeight="medium"
          color={isSelected ? '#2800D7' : '#32343C'}
          noOfLines={1}
        >
          {document.name}
        </Text>
        <Text fontSize="xs" color="#5E6272" whiteSpace="nowrap">
          {document.laws_count} laws
        </Text>
        <Text fontSize="xs" color="#5E6272" whiteSpace="nowrap">
          {formatDate(document.uploaded_at)}
        </Text>
      </Flex>
      {isHovered && (
        <IconButton
          aria-label="Delete document"
          icon={<MdDelete />}
          variant="ghost"
          size="sm"
          color="#5E6272"
          _hover={{ color: 'red.500' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(document.id);
          }}
        />
      )}
    </Flex>
  );
}
