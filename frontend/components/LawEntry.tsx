'use client';

import { Box, Text } from '@chakra-ui/react';
import type { LawResponse } from '@/lib/types';

interface LawEntryProps {
  law: LawResponse;
}

function sectionDepth(section: string): number {
  return section.split('.').length - 1;
}

export default function LawEntry({ law }: LawEntryProps): React.ReactNode {
  const depth = sectionDepth(law.section);

  return (
    <Box pl={depth * 4 + 4} py={1}>
      <Text fontSize="sm" color="#32343C">
        <Text as="span" fontWeight="semibold" color="#2800D7">
          {law.section}
        </Text>{' '}
        {law.text}
      </Text>
    </Box>
  );
}
