'use client';

import {
  Badge,
  Box,
  Flex,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import TopicAccordion from './TopicAccordion';
import LegislationTOC from './LegislationTOC';
import { fetchLaws } from '@/lib/api';
import type { LawGroup } from '@/lib/types';
import { BRAND_PURPLE, HOVER_PURPLE, NEUTRAL_GRAY } from '@/lib/colors';

interface LegislationBrowserProps {
  legislationId: number | null;
  legislationName: string | null;
  jurisdiction: string | null;
}

export default function LegislationBrowser({
  legislationId,
  legislationName,
  jurisdiction,
}: LegislationBrowserProps): React.ReactNode {
  const [groups, setGroups] = useState<LawGroup[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (legislationId === null) {
      setGroups([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchLaws(legislationId)
      .then(setGroups)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [legislationId]);

  if (legislationId === null) return null;

  if (isLoading) {
    return (
      <VStack py={8}>
        <Spinner color={BRAND_PURPLE} />
        <Text fontSize="sm" color={NEUTRAL_GRAY}>
          Loading laws...
        </Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Box bg="red.50" borderRadius="md" px={4} py={3}>
        <Text fontSize="sm" color="red.600">
          {error}
        </Text>
      </Box>
    );
  }

  return (
    <Flex h="100%">
      {groups.length > 0 && (
        <LegislationTOC
          groups={groups}
          scrollContainerRef={scrollContainerRef}
        />
      )}
      <Box ref={scrollContainerRef} flex={1} overflowY="auto" p={6}>
        {legislationName && (
          <Flex align="center" gap={3} mb={6}>
            <Heading size="lg" color={BRAND_PURPLE}>
              {legislationName}
            </Heading>
            {jurisdiction && (
              <Badge
                fontSize="xs"
                px={2}
                py={0.5}
                borderRadius="full"
                bg={HOVER_PURPLE}
                color={BRAND_PURPLE}
                fontWeight="medium"
              >
                {jurisdiction}
              </Badge>
            )}
          </Flex>
        )}
        <TopicAccordion groups={groups} />
      </Box>
    </Flex>
  );
}
