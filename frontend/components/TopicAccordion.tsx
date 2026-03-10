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

interface TopicAccordionProps {
  groups: LawGroup[];
}

export default function TopicAccordion({
  groups,
}: TopicAccordionProps): React.ReactNode {
  if (groups.length === 0) {
    return (
      <Text fontSize="sm" color="#5E6272">
        No laws found.
      </Text>
    );
  }

  return (
    <Accordion allowMultiple>
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
          <AccordionItem key={group.topic} border="none">
            <AccordionButton
              px={2}
              py={2}
              _hover={{ bg: '#F5F5F5' }}
              borderRadius="md"
            >
              <Box flex={1} textAlign="left">
                <Text fontSize="sm" fontWeight="semibold" color="#32343C">
                  {topicNumber}. {group.topic}
                </Text>
              </Box>
              <AccordionIcon color="#5E6272" />
            </AccordionButton>
            <AccordionPanel pb={2} px={0}>
              {subgroups.map((sub, idx) => (
                <Box key={idx}>
                  {sub.title && (
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color="#5E6272"
                      pl={4}
                      pt={1}
                      pb={1}
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
        );
      })}
    </Accordion>
  );
}
