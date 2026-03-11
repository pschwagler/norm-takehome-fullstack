'use client';

import { Flex, IconButton, Input } from '@chakra-ui/react';
import { useState } from 'react';
import { MdSend } from 'react-icons/md';
import { BRAND_PURPLE, BORDER } from '@/lib/colors';

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
        borderColor={BORDER}
        _hover={{ borderColor: BRAND_PURPLE }}
        _focus={{
          borderColor: BRAND_PURPLE,
          boxShadow: `0 0 0 1px ${BRAND_PURPLE}`,
        }}
        size="lg"
        fontSize="md"
      />
      <IconButton
        aria-label="Ask"
        icon={<MdSend />}
        type="submit"
        isDisabled={!value.trim() || isLoading}
        isLoading={isLoading}
        bg={BRAND_PURPLE}
        color="white"
        _hover={{ bg: '#1E00A3' }}
        _disabled={{ bg: BORDER, cursor: 'not-allowed' }}
        size="lg"
      />
    </Flex>
  );
}
