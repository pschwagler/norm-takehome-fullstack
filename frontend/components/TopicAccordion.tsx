'use client';

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Text,
} from '@chakra-ui/react';
import LawEntry from './LawEntry';
import type { LawGroup } from '@/lib/types';
import { NEUTRAL_GRAY, TEXT_PRIMARY } from '@/lib/colors';

interface TopicAccordionProps {
  groups: LawGroup[];
}

export default function TopicAccordion({
  groups,
}: TopicAccordionProps): React.ReactNode {
  if (groups.length === 0) {
    return (
      <Text fontSize="sm" color={NEUTRAL_GRAY}>
        No laws found.
      </Text>
    );
  }

  return (
    <Accordion allowMultiple defaultIndex={groups.map((_, i) => i)}>
      {groups.map((group) => {
        const topicNumber = group.laws[0]?.section.split('.')[0] ?? '';

        // Group laws by section_title for sub-topics
        const subgroups: { title: string | null; laws: typeof group.laws }[] =
          [];
        for (const law of group.laws) {
          const lastGroup = subgroups[subgroups.length - 1];
          if (lastGroup && lastGroup.title === law.section_title) {
            lastGroup.laws.push(law);
          } else {
            subgroups.push({ title: law.section_title, laws: [law] });
          }
        }

        return (
          <Box
            key={group.topic}
            id={`topic-${topicNumber}`}
            sx={{ scrollMarginTop: '60px' }}
          >
            <AccordionItem border="none">
              <AccordionButton
                px={2}
                py={1.5}
                _hover={{ bg: '#F5F5F5' }}
                borderRadius="md"
              >
                <Box flex={1} textAlign="left">
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color={TEXT_PRIMARY}
                  >
                    {topicNumber}. {group.topic}
                  </Text>
                </Box>
                <AccordionIcon color={NEUTRAL_GRAY} />
              </AccordionButton>
              <AccordionPanel pb={2} pt={0} px={0}>
                {subgroups.map((sub, idx) => (
                  <Box key={idx}>
                    {sub.title && (
                      <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color={NEUTRAL_GRAY}
                        pl={4}
                        pt={0.5}
                        pb={0.5}
                      >
                        {sub.title}
                      </Text>
                    )}
                    {sub.laws.map((law) => (
                      <LawEntry key={law.id} law={law} />
                    ))}
                  </Box>
                ))}
              </AccordionPanel>
            </AccordionItem>
          </Box>
        );
      })}
    </Accordion>
  );
}
