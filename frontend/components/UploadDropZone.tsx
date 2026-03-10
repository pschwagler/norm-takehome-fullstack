'use client';

import { Box, Text, VStack } from '@chakra-ui/react';
import { useCallback, useRef, useState } from 'react';
import { MdCloudUpload } from 'react-icons/md';

interface UploadDropZoneProps {
  onFileSelect: (file: File) => void;
}

export default function UploadDropZone({
  onFileSelect,
}: UploadDropZoneProps): React.ReactNode {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        setError('Only PDF files are accepted');
        return;
      }
      setError(null);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <Box>
      <Box
        border="2px dashed"
        borderColor={isDragging ? '#2800D7' : '#DBDCE1'}
        borderRadius="lg"
        bg={isDragging ? '#EEEBFF' : 'white'}
        py={10}
        px={6}
        textAlign="center"
        cursor="pointer"
        transition="all 0.15s"
        _hover={{ borderColor: '#2800D7', bg: '#FAFAFE' }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <VStack spacing={2}>
          <MdCloudUpload size={40} color={isDragging ? '#2800D7' : '#5E6272'} />
          <Text fontSize="sm" color="#5E6272">
            Drag and drop a PDF here, or click to browse
          </Text>
        </VStack>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </Box>
      {error && (
        <Text fontSize="sm" color="red.500" mt={2}>
          {error}
        </Text>
      )}
    </Box>
  );
}
