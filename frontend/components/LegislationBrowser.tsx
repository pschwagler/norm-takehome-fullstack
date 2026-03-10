'use client';

import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import TopicAccordion from './TopicAccordion';
import { fetchLaws } from '@/lib/api';
import type { LawGroup } from '@/lib/types';

interface LegislationBrowserProps {
  legislationId: number | null;
}

export default function LegislationBrowser({
  legislationId,
}: LegislationBrowserProps): React.ReactNode {
  const [groups, setGroups] = useState<LawGroup[]>([]);
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
        <Spinner color="#2800D7" />
        <Text fontSize="sm" color="#5E6272">
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
    <VStack align="stretch" spacing={0}>
      <TopicAccordion groups={groups} />
    </VStack>
  );
}
