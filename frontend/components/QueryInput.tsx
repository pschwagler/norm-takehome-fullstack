'use client';

import { Flex, IconButton, Input } from '@chakra-ui/react';
import { useState } from 'react';
import { MdSend } from 'react-icons/md';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function QueryInput({
  onSubmit,
  isLoading,
}: QueryInputProps): React.ReactNode {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <Flex
      as="form"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        handleSubmit();
      }}
      gap={2}
      align="center"
      w="full"
      maxW="700px"
    >
      <Input
        placeholder="Enter your question..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        bg="white"
        borderColor="#DBDCE1"
        _hover={{ borderColor: '#2800D7' }}
        _focus={{ borderColor: '#2800D7', boxShadow: '0 0 0 1px #2800D7' }}
        size="lg"
        fontSize="md"
      />
      <IconButton
        aria-label="Ask"
        icon={<MdSend />}
        type="submit"
        isDisabled={!value.trim() || isLoading}
        isLoading={isLoading}
        bg="#2800D7"
        color="white"
        _hover={{ bg: '#1E00A3' }}
        _disabled={{ bg: '#DBDCE1', cursor: 'not-allowed' }}
        size="lg"
      />
    </Flex>
  );
}
