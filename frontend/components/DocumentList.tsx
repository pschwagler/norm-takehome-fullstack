'use client';

import { Text, VStack } from '@chakra-ui/react';
import DocumentCard from './DocumentCard';
import type { DocumentResponse } from '@/lib/types';

interface DocumentListProps {
  documents: DocumentResponse[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function DocumentList({
  documents,
  selectedId,
  onSelect,
  onDelete,
}: DocumentListProps): React.ReactNode {
  return (
    <VStack align="stretch" spacing={2}>
      <Text fontSize="md" fontWeight="semibold" color="#32343C">
        Documents
      </Text>
      {documents.length === 0 ? (
        <Text fontSize="sm" color="#5E6272">
          No documents uploaded yet.
        </Text>
      ) : (
        documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            isSelected={doc.id === selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))
      )}
    </VStack>
  );
}
