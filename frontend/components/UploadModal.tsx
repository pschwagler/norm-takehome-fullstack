'use client';

import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
} from '@chakra-ui/react';
import { useState } from 'react';
import { JURISDICTIONS } from '@/lib/types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onUpload: (name: string, jurisdiction: string) => void;
  isUploading: boolean;
}

export default function UploadModal({
  isOpen,
  onClose,
  file,
  onUpload,
  isUploading,
}: UploadModalProps): React.ReactNode {
  const [name, setName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Kingdom-wide');

  function handleSubmit() {
    if (!name.trim()) return;
    onUpload(name.trim(), jurisdiction);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Upload Legislation</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {file && (
            <Text fontSize="sm" color="#5E6272" mb={4}>
              File: {file.name}
            </Text>
          )}
          <FormControl isRequired mb={4}>
            <FormLabel fontSize="sm">Legislation Name</FormLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northern Edicts"
              borderColor="#DBDCE1"
              _focus={{
                borderColor: '#2800D7',
                boxShadow: '0 0 0 1px #2800D7',
              }}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Jurisdiction (optional)</FormLabel>
            <Select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              borderColor="#DBDCE1"
              _focus={{
                borderColor: '#2800D7',
                boxShadow: '0 0 0 1px #2800D7',
              }}
            >
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </Select>
          </FormControl>
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={isUploading}>
            Cancel
          </Button>
          <Button
            bg="#2800D7"
            color="white"
            _hover={{ bg: '#1E00A3' }}
            onClick={handleSubmit}
            isDisabled={!name.trim()}
            isLoading={isUploading}
          >
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
