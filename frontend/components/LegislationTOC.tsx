'use client';

import { Box, Button, Text } from '@chakra-ui/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { LawGroup } from '@/lib/types';
import { BORDER, NEUTRAL_GRAY, HOVER_PURPLE, BRAND_PURPLE } from '@/lib/colors';

interface LegislationTOCProps {
  groups: LawGroup[];
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

export default function LegislationTOC({
  groups,
  scrollContainerRef,
}: LegislationTOCProps): React.ReactNode {
  const ids = useMemo(
    () =>
      groups.map((g) => {
        const num = g.laws[0]?.section.split('.')[0] ?? '';
        return `topic-${num}`;
      }),
    [groups]
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const clickLock = useRef(false);

  // Default to first section when groups change
  useEffect(() => {
    setActiveId(ids[0] ?? null);
  }, [ids]);

  const updateActive = useCallback(() => {
    if (clickLock.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const containerTop = container.getBoundingClientRect().top;
    let current: string | null = null;

    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= containerTop + 80) {
        current = id;
      }
    }

    setActiveId(current ?? ids[0] ?? null);
  }, [ids, scrollContainerRef]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || groups.length === 0) return;

    container.addEventListener('scroll', updateActive, { passive: true });

    return () => container.removeEventListener('scroll', updateActive);
  }, [groups, scrollContainerRef, updateActive]);

  function handleClick(topicNumber: string) {
    const id = `topic-${topicNumber}`;
    setActiveId(id);
    clickLock.current = true;

    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    setTimeout(() => {
      clickLock.current = false;
    }, 800);
  }

  return (
    <Box
      w="200px"
      minW="200px"
      h="100%"
      overflowY="auto"
      borderRight="1px"
      borderColor={BORDER}
      pt={6}
      pr={3}
      pl={3}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color={NEUTRAL_GRAY}
        textTransform="uppercase"
        mb={2}
        pl={3}
      >
        Contents
      </Text>
      {groups.map((group) => {
        const topicNumber = group.laws[0]?.section.split('.')[0] ?? '';
        const id = `topic-${topicNumber}`;
        const isActive = activeId === id;

        return (
          <Button
            key={group.topic}
            variant="ghost"
            fontSize="sm"
            justifyContent="flex-start"
            w="100%"
            fontWeight={isActive ? 'semibold' : 'normal'}
            bg={isActive ? HOVER_PURPLE : 'transparent'}
            color={isActive ? BRAND_PURPLE : undefined}
            _hover={{ bg: HOVER_PURPLE }}
            onClick={() => handleClick(topicNumber)}
            borderRadius="md"
            px={3}
            py={1.5}
            h="auto"
            whiteSpace="normal"
            textAlign="left"
          >
            {topicNumber}. {group.topic}
          </Button>
        );
      })}
    </Box>
  );
}
