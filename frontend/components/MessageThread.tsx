'use client';

import { Avatar, Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import NormAvatar from './NormAvatar';
import CollapsibleCitations from './CollapsibleCitations';
import type { ActiveMessage } from '@/lib/types';

interface MessageThreadProps {
  messages: ActiveMessage[];
}

export default function MessageThread({
  messages,
}: MessageThreadProps): React.ReactNode {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <VStack spacing={4} align="stretch" w="full" maxW="700px" mx="auto">
      {messages.map((msg, i) =>
        msg.role === 'user' ? (
          <UserMessage key={i} content={msg.content} />
        ) : (
          <AssistantMessage key={i} message={msg} />
        )
      )}
      <div ref={bottomRef} />
    </VStack>
  );
}

function UserMessage({ content }: { content: string }): React.ReactNode {
  return (
    <Flex justifyContent="flex-end" gap={3}>
      <Box
        bg="#EEEBFF"
        color="#2800D7"
        borderRadius="lg"
        px={4}
        py={2}
        maxW="80%"
      >
        <Text fontSize="md" whiteSpace="pre-wrap">
          {content}
        </Text>
      </Box>
      <Avatar
        name="Tyrion Lannister"
        size="sm"
        bg="#5E6272"
        color="white"
        alignSelf="flex-start"
      />
    </Flex>
  );
}

function AssistantMessage({
  message,
}: {
  message: ActiveMessage;
}): React.ReactNode {
  const { content, citations, isStreaming } = message;

  return (
    <Flex justifyContent="flex-start" gap={3}>
      <Box alignSelf="flex-start" mt={1}>
        <NormAvatar size="32px" />
      </Box>
      <Box
        flex={1}
        bg="white"
        border="1px solid"
        borderColor="#DBDCE1"
        borderRadius="lg"
        px={4}
        py={3}
        maxW="85%"
      >
        {isStreaming && content === '' ? (
          <LoadingDots />
        ) : (
          <>
            <Text
              fontSize="md"
              color="#32343C"
              lineHeight="1.7"
              whiteSpace="pre-wrap"
            >
              {content}
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
            {!isStreaming && citations.length > 0 && (
              <Box mt={3}>
                <CollapsibleCitations citations={citations} />
              </Box>
            )}
          </>
        )}
      </Box>
    </Flex>
  );
}

function LoadingDots(): React.ReactNode {
  return (
    <Flex gap={1} py={1}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          w="8px"
          h="8px"
          borderRadius="full"
          bg="#2800D7"
          animation={`pulse 1.2s ease-in-out ${i * 0.2}s infinite`}
          sx={{
            '@keyframes pulse': {
              '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
              '40%': { opacity: 1, transform: 'scale(1)' },
            },
          }}
        />
      ))}
    </Flex>
  );
}
