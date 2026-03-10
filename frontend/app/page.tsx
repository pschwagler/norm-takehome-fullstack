'use client';

import { Box, Flex, Text, VStack, useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import HeaderNav from '@/components/HeaderNav';
import ConversationSidebar from '@/components/ConversationSidebar';
import QueryInput from '@/components/QueryInput';
import MessageThread from '@/components/MessageThread';
import {
  deleteThread,
  fetchThread,
  fetchThreads,
  streamQuery,
} from '@/lib/api';
import type { ActiveMessage, ThreadSummary } from '@/lib/types';

export default function Page(): React.ReactNode {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ActiveMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toast = useToast();

  const loadThreads = useCallback(() => {
    fetchThreads()
      .then(setThreads)
      .catch(() => {});
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
  }

  function handleSelectThread(id: number) {
    if (abortRef.current) abortRef.current.abort();
    setActiveThreadId(id);
    setIsStreaming(false);
    setError(null);

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
      .catch(() => {});
  }

  function handleSubmit(query: string) {
    if (abortRef.current) abortRef.current.abort();

    setError(null);
    setIsStreaming(true);

    // Append user message + empty assistant placeholder
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
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.content = last.content + token;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onCitations(cits) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.citations = cits;
            updated[updated.length - 1] = last;
            return updated;
          });
        },
        onDone(threadId) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.isStreaming = false;
            updated[updated.length - 1] = last;
            return updated;
          });
          setActiveThreadId(threadId);
          setIsStreaming(false);
          loadThreads();
        },
        onError(errMsg) {
          setError(errMsg);
          setIsStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] };
            last.isStreaming = false;
            updated[updated.length - 1] = last;
            return updated;
          });
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
        <Flex flex={1} direction="column" bg="#FBFBFB" overflow="hidden">
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
                  color="#32343C"
                  textAlign="center"
                >
                  Westeros Legal Compliance
                </Text>
                <Text fontSize="sm" color="#5E6272" textAlign="center">
                  Ask a question about the laws of the Seven Kingdoms
                </Text>
              </VStack>
              <QueryInput onSubmit={handleSubmit} isLoading={isStreaming} />
            </Flex>
          ) : (
            <>
              <Box flex={1} overflowY="auto" px={6} py={6}>
                <MessageThread messages={messages} />
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
                borderColor="#DBDCE1"
                bg="#FBFBFB"
              >
                <Flex justify="center">
                  <QueryInput onSubmit={handleSubmit} isLoading={isStreaming} />
                </Flex>
              </Box>
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
