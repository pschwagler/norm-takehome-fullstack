'use client';

import { Box, Flex, useDisclosure, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import HeaderNav from '@/components/HeaderNav';
import UploadDropZone from '@/components/UploadDropZone';
import UploadModal from '@/components/UploadModal';
import DocumentList from '@/components/DocumentList';
import LegislationBrowser from '@/components/LegislationBrowser';
import {
  deleteDocument,
  fetchDocuments,
  uploadDocument,
} from '@/lib/api';
import type { DocumentResponse } from '@/lib/types';

export default function DocumentsPage(): React.ReactNode {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const loadDocuments = useCallback(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  function handleFileSelect(file: File) {
    setPendingFile(file);
    onOpen();
  }

  function handleUpload(name: string, jurisdiction: string) {
    if (!pendingFile) return;
    setIsUploading(true);

    uploadDocument(pendingFile, name, jurisdiction)
      .then(() => {
        onClose();
        setPendingFile(null);
        loadDocuments();
        toast({
          title: 'Document uploaded',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      })
      .catch((err: Error) => {
        toast({
          title: 'Upload failed',
          description: err.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      })
      .finally(() => setIsUploading(false));
  }

  function handleDelete(id: number) {
    deleteDocument(id)
      .then(() => {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        if (selectedId === id) setSelectedId(null);
      })
      .catch((err: Error) => {
        toast({
          title: 'Delete failed',
          description: err.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      });
  }

  function handleModalClose() {
    if (!isUploading) {
      onClose();
      setPendingFile(null);
    }
  }

  return (
    <Flex h="100vh" direction="column">
      <HeaderNav signOut={() => {}} />
      <Flex flex={1} overflow="hidden">
        <Box
          w="340px"
          minW="340px"
          borderRight="1px"
          borderColor="#DBDCE1"
          bg="#FBFBFB"
          p={4}
          overflowY="auto"
        >
          <Box mb={4}>
            <UploadDropZone onFileSelect={handleFileSelect} />
          </Box>
          <DocumentList
            documents={documents}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </Box>
        <Box flex={1} overflow="auto" bg="white" p={6}>
          <LegislationBrowser documentId={selectedId} />
        </Box>
      </Flex>
      <UploadModal
        isOpen={isOpen}
        onClose={handleModalClose}
        file={pendingFile}
        onUpload={handleUpload}
        isUploading={isUploading}
      />
    </Flex>
  );
}
