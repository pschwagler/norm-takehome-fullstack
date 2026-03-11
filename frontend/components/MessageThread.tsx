'use client';

import { Avatar, Box, Flex, Text, VStack } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkCitationPlugin from '@/lib/remarkCitationPlugin';
import { CitationContext, MARKDOWN_COMPONENTS } from './MarkdownComponents';
import NormAvatar from './NormAvatar';
import type { ActiveMessage } from '@/lib/types';
import {
  BRAND_PURPLE,
  NEUTRAL_GRAY,
  BORDER,
  HOVER_PURPLE,
  TEXT_PRIMARY,
} from '@/lib/colors';

// Stable reference prevents React remounts during streaming
const REMARK_PLUGINS = [remarkGfm, remarkCitationPlugin];

interface MessageThreadProps {
  messages: ActiveMessage[];
  localToGlobal: (messageIndex: number, localCitationIndex: number) => number;
  onCitationClick?: (globalIndex: number) => void;
}

export default function MessageThread({
  messages,
  localToGlobal,
  onCitationClick,
}: MessageThreadProps): React.ReactNode {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <VStack spacing={4} align="stretch" w="full" maxW="700px" mx="auto">
      {messages.map((msg, i) =>
        msg.role === 'user' ? (
          <UserMessage key={`user-${i}`} content={msg.content} />
        ) : (
          <AssistantMessage
            key={`assistant-${i}`}
            message={msg}
            localToGlobal={(localIdx) => localToGlobal(i, localIdx)}
            onCitationClick={onCitationClick}
          />
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
        bg={HOVER_PURPLE}
        color={BRAND_PURPLE}
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
        bg={NEUTRAL_GRAY}
        color="white"
        alignSelf="flex-start"
      />
    </Flex>
  );
}

interface AssistantMessageProps {
  message: ActiveMessage;
  localToGlobal: (localCitationIndex: number) => number;
  onCitationClick?: (globalIndex: number) => void;
}

function AssistantMessage({
  message,
  localToGlobal,
  onCitationClick,
}: AssistantMessageProps): React.ReactNode {
  const { content, isStreaming } = message;

  return (
    <Flex justifyContent="flex-start" gap={3}>
      <Box alignSelf="flex-start" mt={1}>
        <NormAvatar size="32px" />
      </Box>
      <Box
        flex={1}
        bg="white"
        border="1px solid"
        borderColor={BORDER}
        borderRadius="lg"
        px={4}
        py={3}
        maxW="85%"
      >
        {isStreaming && content === '' ? (
          <LoadingDots />
        ) : (
          <CitationContext.Provider value={{ localToGlobal, onCitationClick }}>
            <Box fontSize="md" color={TEXT_PRIMARY} lineHeight="1.7">
              <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                components={MARKDOWN_COMPONENTS}
              >
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <Box
                  as="span"
                  display="inline-block"
                  w="2px"
                  h="1em"
                  bg={BRAND_PURPLE}
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
            </Box>
          </CitationContext.Provider>
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
          bg={BRAND_PURPLE}
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
