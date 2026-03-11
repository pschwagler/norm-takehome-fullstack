'use client';

import { Box, Flex, Text, VStack, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HeaderNav from '@/components/HeaderNav';
import ConversationSidebar from '@/components/ConversationSidebar';
import QueryInput from '@/components/QueryInput';
import MessageThread from '@/components/MessageThread';
import CitationDrawer from '@/components/CitationDrawer';
import { buildCitationIndex } from '@/lib/citations';
import {
  deleteThread,
  fetchThread,
  fetchThreads,
  streamQuery,
} from '@/lib/api';
import type { ActiveMessage, ThreadSummary } from '@/lib/types';
import { BG, TEXT_PRIMARY, NEUTRAL_GRAY, BORDER } from '@/lib/colors';

function updateLastMessage(
  prev: ActiveMessage[],
  patch: Partial<ActiveMessage>
): ActiveMessage[] {
  const updated = [...prev];
  updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
  return updated;
}

export default function Page(): React.ReactNode {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ActiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCitationCountRef = useRef(0);
  const toast = useToast();

  const citationIndex = useMemo(() => buildCitationIndex(messages), [messages]);

  // Auto-open drawer when first citations arrive
  useEffect(() => {
    const count = citationIndex.unique.length;
    if (prevCitationCountRef.current === 0 && count > 0) {
      setIsCitationDrawerOpen(true);
    }
    prevCitationCountRef.current = count;
  }, [citationIndex.unique]);

  const loadThreads = useCallback(() => {
    fetchThreads()
      .then(setThreads)
      .catch((err: Error) => {
        console.error('Failed to load threads:', err.message);
      });
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  function handleNewConversation() {
    if (abortRef.current) abortRef.current.abort();
    setActiveThreadId(null);
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    setIsCitationDrawerOpen(false);
    setHighlightedCitation(null);
    prevCitationCountRef.current = 0;
  }

  function handleSelectThread(id: number) {
    if (abortRef.current) abortRef.current.abort();
    setActiveThreadId(id);
    setIsStreaming(false);
    setError(null);
    setHighlightedCitation(null);
    prevCitationCountRef.current = 0;

    fetchThread(id)
      .then((thread) => {
        const loaded: ActiveMessage[] = thread.messages.map((m) => ({
          role: m.role,
          content: m.content,
          citations: m.citations,
          isStreaming: false,
        }));
        setMessages(loaded);
      })
      .catch((err: Error) => {
        setError(err.message);
        setMessages([]);
      });
  }

  function handleDeleteThread(id: number) {
    deleteThread(id)
      .then(() => {
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (activeThreadId === id) {
          handleNewConversation();
        }
      })
      .catch((err: Error) => {
        toast({
          title: 'Failed to delete thread',
          description: err.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      });
  }

  function handleCitationClick(globalIndex: number) {
    setIsCitationDrawerOpen(true);
    setHighlightedCitation(globalIndex);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedCitation(null);
      highlightTimerRef.current = null;
    }, 2000);
  }

  function handleSubmit(query: string) {
    if (abortRef.current) abortRef.current.abort();

    setError(null);
    setIsStreaming(true);

    const userMsg: ActiveMessage = {
      role: 'user',
      content: query,
      citations: [],
      isStreaming: false,
    };
    const assistantMsg: ActiveMessage = {
      role: 'assistant',
      content: '',
      citations: [],
      isStreaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const ctrl = streamQuery(
      query,
      {
        onToken(token) {
          setMessages((prev) =>
            updateLastMessage(prev, {
              content: prev[prev.length - 1].content + token,
            })
          );
        },
        onCitations(cits) {
          setMessages((prev) => updateLastMessage(prev, { citations: cits }));
        },
        onDone(threadId, response) {
          setMessages((prev) =>
            updateLastMessage(prev, {
              isStreaming: false,
              ...(response !== undefined ? { content: response } : {}),
            })
          );
          setActiveThreadId(threadId);
          setIsStreaming(false);
          loadThreads();
        },
        onError(errMsg) {
          setError(errMsg);
          setIsStreaming(false);
          setMessages((prev) =>
            updateLastMessage(prev, { isStreaming: false })
          );
          toast({
            title: 'Query failed',
            description: errMsg,
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        },
      },
      undefined,
      activeThreadId ?? undefined
    );

    abortRef.current = ctrl;
  }

  const hasMessages = messages.length > 0;

  return (
    <Flex h="100vh" direction="column">
      <HeaderNav signOut={() => {}} />
      <Flex flex={1} overflow="hidden">
        <ConversationSidebar
          threads={threads}
          activeId={activeThreadId}
          onSelect={handleSelectThread}
          onDelete={handleDeleteThread}
          onNewConversation={handleNewConversation}
        />
        <Flex flex={1} direction="column" bg={BG} overflow="hidden">
          {!hasMessages ? (
            <Flex
              flex={1}
              direction="column"
              align="center"
              justify="center"
              px={6}
            >
              <VStack spacing={2} mb={6}>
                <Text
                  fontSize="2xl"
                  fontWeight="bold"
                  color={TEXT_PRIMARY}
                  textAlign="center"
                >
                  Westeros Legal Compliance
                </Text>
                <Text fontSize="sm" color={NEUTRAL_GRAY} textAlign="center">
                  Ask a question about the laws of the Seven Kingdoms
                </Text>
              </VStack>
              <QueryInput onSubmit={handleSubmit} isLoading={isStreaming} />
            </Flex>
          ) : (
            <>
              <Box flex={1} overflowY="auto" px={6} py={6}>
                <MessageThread
                  messages={messages}
                  localToGlobal={citationIndex.localToGlobal}
                  onCitationClick={handleCitationClick}
                />
                {error && (
                  <Box
                    mt={4}
                    bg="red.50"
                    border="1px solid"
                    borderColor="red.200"
                    borderRadius="md"
                    px={4}
                    py={3}
                    maxW="700px"
                    mx="auto"
                  >
                    <Text color="red.600" fontSize="sm">
                      {error}
                    </Text>
                  </Box>
                )}
              </Box>
              <Box
                px={6}
                py={4}
                borderTop="1px solid"
                borderColor={BORDER}
                bg={BG}
              >
                <Flex justify="center">
                  <QueryInput onSubmit={handleSubmit} isLoading={isStreaming} />
                </Flex>
              </Box>
            </>
          )}
        </Flex>
        <CitationDrawer
          citations={citationIndex.unique}
          isOpen={isCitationDrawerOpen}
          onToggle={() => setIsCitationDrawerOpen((prev) => !prev)}
          highlightedIndex={highlightedCitation}
        />
      </Flex>
    </Flex>
  );
}
