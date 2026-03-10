'use client';

import {
  Box,
  Flex,
  IconButton,
  Text,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import { MdDelete } from 'react-icons/md';
import type { ConversationSummary } from '@/lib/types';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
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
  conversations,
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
      <Flex px={isExpanded ? 3 : 1} py={2} gap={2} align="center">
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
        <Tooltip label="New Conversation" placement="right">
          <IconButton
            aria-label="New Conversation"
            icon={
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12.6667 0.666504H3.33333C2.59695 0.666504 2 1.26346 2 1.99984V15.3332L8 11.9998L14 15.3332V1.99984C14 1.26346 13.403 0.666504 12.6667 0.666504ZM12.6667 12.6665L8 10.0732L3.33333 12.6665V1.99984H12.6667V12.6665Z"
                  fill="#5E6272"
                />
                <path d="M7.33333 4H8.66667V6.66667H11.3333V8H8.66667V10.6667H7.33333V8H4.66667V6.66667H7.33333V4Z" fill="#5E6272" />
              </svg>
            }
            variant="ghost"
            size="sm"
            onClick={onNewConversation}
          />
        </Tooltip>
        {isExpanded && (
          <Text fontSize="xs" color="#5E6272" fontWeight="semibold" noOfLines={1}>
            New Conversation
          </Text>
        )}
      </Flex>

      {isExpanded && (
        <VStack
          spacing={0}
          align="stretch"
          overflowY="auto"
          flex={1}
          px={1}
        >
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </VStack>
      )}
    </Box>
  );
}

interface ConversationItemProps {
  conversation: ConversationSummary;
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps): React.ReactNode {
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
      onClick={() => onSelect(conversation.id)}
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
          {conversation.query}
        </Text>
        <Text fontSize="xs" color="#5E6272">
          {formatDate(conversation.created_at)}
        </Text>
      </Box>
      {isHovered && (
        <IconButton
          aria-label="Delete conversation"
          icon={<MdDelete />}
          variant="ghost"
          size="xs"
          color="#5E6272"
          _hover={{ color: 'red.500' }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation.id);
          }}
        />
      )}
    </Flex>
  );
}
