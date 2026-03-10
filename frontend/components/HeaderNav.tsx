'use client';

import Link from 'next/link';
import {
  Avatar,
  Box,
  Flex,
  HStack,
  Image,
  Text,
  FlexProps,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Icon,
  Tooltip,
} from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';
import { useEffect, useState } from 'react';
import { MdLogout } from 'react-icons/md';
import NavButton, { NavIconEnum } from './NavButton';

interface HeaderProps extends FlexProps {
  signOut: () => void;
}

export default function HeaderNav({
  signOut,
  ...rest
}: HeaderProps): React.ReactNode {
  const [isHovered, setIsHovered] = useState(false);
  const color = isHovered ? '#2800D7' : '#5E6272';

  return (
    <Flex
      px={{ base: 4, md: 4 }}
      alignItems="center"
      bg="#FBFBFB"
      justifyContent={{ base: 'space-between', md: 'flex-end' }}
      borderBottom="1px"
      borderColor="#DBDCE1"
      {...rest}
    >
      <Flex justifyContent="flex-start" width="full" alignItems="center">
        <Link href={`/`}>
          <Box
            as={Image}
            src="/logo.svg"
            alt="Norm Ai Logo"
            height="32px"
            _active={{ transform: 'scale(.95)' }}
          />
        </Link>
        <Box height="32px" width="1px" bg="#DBDCE1" mx={3} />
        <Text
          fontSize="md"
          userSelect="none"
          fontWeight="bold"
          color="blackAlpha.800"
        >
          Westeros Capital Group
        </Text>
      </Flex>
      <HStack>
        <Flex alignItems={'center'}>
          <Menu>
            <HStack>
              <HStack spacing="16px">
                <NavButton
                  navIconEnum={NavIconEnum.HOME}
                  label="Home"
                  linkPath="/"
                />
                <NavButton
                  navIconEnum={NavIconEnum.DOCUMENT}
                  label="Legislation"
                  linkPath="/legislation"
                />
              </HStack>
              <Box height="32px" width="1px" bg="#DBDCE1" mx={3} />
              <MenuButton
                py={2}
                transition="all 0.3s"
                _focus={{ boxShadow: 'none' }}
                flexGrow={1}
                width="auto"
                onMouseDown={(e: React.MouseEvent) =>
                  ((e.currentTarget as HTMLElement).style.transform =
                    'scale(.95)')
                }
                onMouseUp={(e: React.MouseEvent) =>
                  ((e.currentTarget as HTMLElement).style.transform =
                    'scale(1)')
                }
                onMouseLeave={(e: React.MouseEvent) =>
                  ((e.currentTarget as HTMLElement).style.transform =
                    'scale(1)')
                }
              >
                <HStack>
                  <Avatar size={'sm'} name="Tyrion Lannister" boxSize="32px" />
                  <Text whiteSpace="nowrap" width="auto" fontSize="sm">
                    Tyrion Lannister
                  </Text>
                  <Box display={{ base: 'none', md: 'flex' }}>
                    <FiChevronDown />
                  </Box>
                </HStack>
              </MenuButton>
            </HStack>
            <MenuList bg="white" borderColor="#DBDCE1" zIndex={100}>
              <MenuItem
                color={'#32343C'}
                _hover={{ bg: '#EEEBFF', color: '#2800D7' }}
                _focus={{ bg: '#EEEBFF', color: '#2800D7' }}
                _active={{ bg: '#EEEBFF', color: '#2800D7' }}
                onClick={signOut}
              >
                <Box
                  paddingRight="8px"
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Icon as={MdLogout} width={'20px'} height={'20px'} />
                </Box>
                Sign out
              </MenuItem>
            </MenuList>
            <Box height="32px" width="1px" bg="#DBDCE1" mx={3} />
            <Tooltip hasArrow label="Help Documentation" placement="bottom">
              <Box
                width="36px"
                cursor="pointer"
                height="36px"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => {}}
              >
                <Box
                  width="36px"
                  height="36px"
                  borderRadius="100px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  fill={color}
                  _hover={{ bgColor: '#FFFFFF' }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 16H11V14H9V16ZM10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM10 18C5.59 18 2 14.41 2 10C2 5.59 5.59 2 10 2C14.41 2 18 5.59 18 10C18 14.41 14.41 18 10 18ZM10 4C7.79 4 6 5.79 6 8H8C8 6.9 8.9 6 10 6C11.1 6 12 6.9 12 8C12 10 9 9.75 9 13H11C11 10.75 14 10.5 14 8C14 5.79 12.21 4 10 4Z"
                      fill="#5E6272"
                    />
                  </svg>
                </Box>
              </Box>
            </Tooltip>
          </Menu>
        </Flex>
      </HStack>
    </Flex>
  );
}
