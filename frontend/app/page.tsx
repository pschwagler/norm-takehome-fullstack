'use client';

import { Box, Flex, Text, VStack, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import HeaderNav from '@/components/HeaderNav';
import ConversationSidebar from '@/components/ConversationSidebar';
import QueryInput from '@/components/QueryInput';
import QueryResponse from '@/components/QueryResponse';
import {
  deleteConversation,
  fetchConversation,
  fetchConversations,
  streamQuery,
} from '@/lib/api';
import type { Citation, ConversationSummary } from '@/lib/types';

export default function Page(): React.ReactNode {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [response, setResponse] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  const loadConversations = useCallback(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  function handleNewConversation() {
    if (abortRef.current) abortRef.current.abort();
    setActiveId(null);
    setResponse('');
    setCitations([]);
    setError(null);
    setIsStreaming(false);
  }

  function handleSelectConversation(id: number) {
    if (abortRef.current) abortRef.current.abort();
    setActiveId(id);
    setIsStreaming(false);
    setError(null);

    fetchConversation(id)
      .then((conv) => {
        setResponse(conv.response);
        setCitations(conv.citations);
      })
      .catch((err: Error) => {
        setError(err.message);
        setResponse('');
        setCitations([]);
      });
  }

  function handleDeleteConversation(id: number) {
    deleteConversation(id)
      .then(() => {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          handleNewConversation();
        }
      })
      .catch(() => {});
  }

  function handleSubmit(query: string) {
    if (abortRef.current) abortRef.current.abort();

    setResponse('');
    setCitations([]);
    setError(null);
    setIsStreaming(true);
    setActiveId(null);

    const ctrl = streamQuery(query, {
      onToken(token) {
        setResponse((prev) => prev + token);
      },
      onCitations(cits) {
        setCitations(cits);
      },
      onDone() {
        setIsStreaming(false);
        loadConversations();
      },
      onError(errMsg) {
        setError(errMsg);
        setIsStreaming(false);
        toast({
          title: 'Query failed',
          description: errMsg,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      },
    });

    abortRef.current = ctrl;
  }

  const hasSubmitted = response.length > 0 || isStreaming || error !== null;

  return (
    <Flex h="100vh" direction="column">
      <HeaderNav signOut={() => {}} />
      <Flex flex={1} overflow="hidden">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onNewConversation={handleNewConversation}
        />
        <Box flex={1} overflow="auto" bg="#FBFBFB">
          <Flex
            direction="column"
            align="center"
            justify={hasSubmitted ? 'flex-start' : 'center'}
            minH="full"
            px={6}
            py={hasSubmitted ? 6 : 0}
            transition="all 0.3s"
          >
            {!hasSubmitted && (
              <VStack spacing={2} mb={6}>
                <Text
                  fontSize="2xl"
                  fontWeight="bold"
                  color="#32343C"
                  textAlign="center"
                >
                  Westeros Legal Compliance
                </Text>
                <Text fontSize="sm" color="#5E6272" textAlign="center">
                  Ask a question about the laws of the Seven Kingdoms
                </Text>
              </VStack>
            )}
            <QueryInput onSubmit={handleSubmit} isLoading={isStreaming} />
            {hasSubmitted && (
              <Box mt={6} w="full" maxW="700px">
                <QueryResponse
                  response={response}
                  citations={citations}
                  isStreaming={isStreaming}
                  error={error}
                />
              </Box>
            )}
          </Flex>
        </Box>
      </Flex>
    </Flex>
  );
}
