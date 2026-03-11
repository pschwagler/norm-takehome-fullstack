'use client';

import { Box, Text } from '@chakra-ui/react';
import type { LawResponse } from '@/lib/types';
import { TEXT_PRIMARY, BRAND_PURPLE } from '@/lib/colors';

interface LawEntryProps {
  law: LawResponse;
}

function sectionDepth(section: string): number {
  return section.split('.').length - 1;
}

export default function LawEntry({ law }: LawEntryProps): React.ReactNode {
  const depth = sectionDepth(law.section);

  return (
    <Box pl={depth * 4 + 4} py={0.5}>
      <Text fontSize="sm" color={TEXT_PRIMARY}>
        <Text as="span" fontWeight="semibold" color={BRAND_PURPLE}>
          {law.section}
        </Text>{' '}
        {law.text}
      </Text>
    </Box>
  );
}
