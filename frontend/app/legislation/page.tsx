'use client';

import { Box, Flex, useDisclosure, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import HeaderNav from '@/components/HeaderNav';
import UploadDropZone from '@/components/UploadDropZone';
import UploadModal from '@/components/UploadModal';
import LegislationList from '@/components/LegislationList';
import LegislationBrowser from '@/components/LegislationBrowser';
import {
  deleteLegislation,
  fetchLegislation,
  uploadLegislation,
} from '@/lib/api';
import type { LegislationResponse } from '@/lib/types';
import { BORDER, BG } from '@/lib/colors';

export default function LegislationPage(): React.ReactNode {
  const [legislationList, setLegislationList] = useState<LegislationResponse[]>(
    []
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const loadLegislation = useCallback(() => {
    fetchLegislation()
      .then(setLegislationList)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadLegislation();
  }, [loadLegislation]);

  const selectedLegislation =
    legislationList.find((l) => l.id === selectedId) ?? null;

  function handleFileSelect(file: File) {
    setPendingFile(file);
    onOpen();
  }

  function handleUpload(name: string, jurisdiction: string) {
    if (!pendingFile) return;
    setIsUploading(true);

    uploadLegislation(pendingFile, name, jurisdiction)
      .then(() => {
        onClose();
        setPendingFile(null);
        loadLegislation();
        toast({
          title: 'Legislation uploaded',
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
    deleteLegislation(id)
      .then(() => {
        setLegislationList((prev) => prev.filter((l) => l.id !== id));
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
          borderColor={BORDER}
          bg={BG}
          p={4}
          overflowY="auto"
        >
          <Box mb={4}>
            <UploadDropZone onFileSelect={handleFileSelect} />
          </Box>
          <LegislationList
            legislationList={legislationList}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={handleDelete}
          />
        </Box>
        <Box flex={1} overflow="hidden" bg="white">
          <LegislationBrowser
            legislationId={selectedId}
            legislationName={selectedLegislation?.name ?? null}
            jurisdiction={selectedLegislation?.jurisdiction ?? null}
          />
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
