'use client';

import { Box, Skeleton, SkeletonText, Text, VStack } from '@chakra-ui/react';
import CitationList from './CitationList';
import type { Citation } from '@/lib/types';

interface QueryResponseProps {
  response: string;
  citations: Citation[];
  isStreaming: boolean;
  error: string | null;
}

export default function QueryResponse({
  response,
  citations,
  isStreaming,
  error,
}: QueryResponseProps): React.ReactNode {
  if (error) {
    return (
      <Box
        bg="red.50"
        border="1px solid"
        borderColor="red.200"
        borderRadius="md"
        px={4}
        py={3}
        w="full"
        maxW="700px"
      >
        <Text color="red.600" fontSize="sm">
          {error}
        </Text>
      </Box>
    );
  }

  if (!response && isStreaming) {
    return (
      <VStack align="stretch" spacing={4} w="full" maxW="700px">
        <SkeletonText noOfLines={4} spacing={3} />
        <Skeleton height="60px" borderRadius="md" />
      </VStack>
    );
  }

  if (!response) return null;

  return (
    <VStack align="stretch" spacing={4} w="full" maxW="700px">
      <Box>
        <Text
          fontSize="md"
          color="#32343C"
          lineHeight="1.7"
          whiteSpace="pre-wrap"
        >
          {response}
          {isStreaming && (
            <Box
              as="span"
              display="inline-block"
              w="2px"
              h="1em"
              bg="#2800D7"
              ml={1}
              animation="blink 1s infinite"
              verticalAlign="text-bottom"
              sx={{
                '@keyframes blink': {
                  '0%, 50%': { opacity: 1 },
                  '51%, 100%': { opacity: 0 },
                },
              }}
            />
          )}
        </Text>
      </Box>
      {!isStreaming && <CitationList citations={citations} />}
    </VStack>
  );
}
