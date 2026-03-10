'use client';

import { Box, Flex, IconButton, Text, Tooltip, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { MdDelete, MdModeEdit } from 'react-icons/md';
import type { ThreadSummary } from '@/lib/types';

interface ConversationSidebarProps {
  threads: ThreadSummary[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNewConversation: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ConversationSidebar({
  threads,
  activeId,
  onSelect,
  onDelete,
  onNewConversation,
}: ConversationSidebarProps): React.ReactNode {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box
      width={isExpanded ? '260px' : '48px'}
      minWidth={isExpanded ? '260px' : '48px'}
      borderRight="1px"
      borderColor="#DBDCE1"
      bg="#FBFBFB"
      transition="width 0.2s, min-width 0.2s"
      overflow="hidden"
      display="flex"
      flexDirection="column"
      h="full"
    >
      <Flex px={isExpanded ? 3 : 1} py={2} align="center">
        <Tooltip label={isExpanded ? 'Collapse' : 'Expand'} placement="right">
          <IconButton
            aria-label="Toggle sidebar"
            icon={
              <svg
                width="18"
                height="14"
                viewBox="0 0 18 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0 0H18V2H0V0Z" fill="#5E6272" />
                <path d="M0 6H18V8H0V6Z" fill="#5E6272" />
                <path d="M0 12H18V14H0V12Z" fill="#5E6272" />
              </svg>
            }
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </Tooltip>
      </Flex>
      <Flex px={isExpanded ? 3 : 1} pb={2} gap={2} align="center">
        <Tooltip label="New Conversation" placement="right">
          <IconButton
            aria-label="New Conversation"
            icon={<MdModeEdit color="#5E6272" size={20} />}
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
          />
        </Tooltip>
        {isExpanded && (
          <Text
            fontSize="xs"
            color="#5E6272"
            fontWeight="semibold"
            noOfLines={1}
          >
            New Conversation
          </Text>
        )}
      </Flex>

      {isExpanded && (
        <VStack spacing={0} align="stretch" overflowY="auto" flex={1} px={1}>
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === activeId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </VStack>
      )}
    </Box>
  );
}

interface ThreadItemProps {
  thread: ThreadSummary;
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function ThreadItem({
  thread,
  isActive,
  onSelect,
  onDelete,
}: ThreadItemProps): React.ReactNode {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      px={2}
      py={2}
      cursor="pointer"
      borderRadius="md"
      bg={isActive ? '#EEEBFF' : 'transparent'}
      _hover={{ bg: isActive ? '#EEEBFF' : '#F5F5F5' }}
      align="center"
      justify="space-between"
      onClick={() => onSelect(thread.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box flex={1} minW={0}>
        <Text
          fontSize="sm"
          noOfLines={1}
          color={isActive ? '#2800D7' : '#32343C'}
          fontWeight={isActive ? 'semibold' : 'normal'}
        >
          {thread.title}
        </Text>
        <Text fontSize="xs" color="#5E6272">
          {formatDate(thread.created_at)}
        </Text>
      </Box>
      {isHovered && (
        <IconButton
          aria-label="Delete thread"
          icon={<MdDelete />}
          variant="ghost"
          size="xs"
          color="#5E6272"
          _hover={{ color: 'red.500' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(thread.id);
          }}
        />
      )}
    </Flex>
  );
}
