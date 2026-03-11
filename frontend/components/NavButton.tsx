import { Box, Tooltip, Button } from '@chakra-ui/react';
import Link from 'next/link';
import { useState } from 'react';
import { MdOutlineHome, MdAccountBalance } from 'react-icons/md';
import { BRAND_PURPLE, NEUTRAL_GRAY } from '@/lib/colors';

export enum NavIconEnum {
  HOME = 'HOME',
  DOCUMENT = 'DOCUMENT',
}

interface NavButtonProps {
  linkPath?: string;
  label: string;
  navIconEnum: NavIconEnum;
  onClick?: () => void;
}

function iconFromEnum(
  navIconEnum: NavIconEnum,
  isHovered: boolean
): JSX.Element {
  const color = isHovered ? BRAND_PURPLE : NEUTRAL_GRAY;

  switch (navIconEnum) {
    case NavIconEnum.HOME:
      return <MdOutlineHome color={color} size="29px" />;
    case NavIconEnum.DOCUMENT:
      return <MdAccountBalance color={color} size="26px" />;
  }
}

export default function NavButton({
  onClick,
  linkPath,
  label,
  navIconEnum,
}: NavButtonProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);

  if (process.env.NODE_ENV !== 'production' && linkPath && onClick) {
    console.error('NavButton cannot have both linkPath and onClick');
  }

  const linkIcon = (
    <Box
      width="36px"
      height="36px"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <Box
        width="36px"
        height="36px"
        borderRadius="100px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        _hover={{ bgColor: '#FFFFFF' }}
      >
        {iconFromEnum(navIconEnum, isHovered)}
      </Box>
    </Box>
  );

  return (
    <Tooltip hasArrow label={label} placement="bottom">
      <Button variant="unstyled">
        {linkPath ? <Link href={linkPath}>{linkIcon}</Link> : linkIcon}
      </Button>
    </Tooltip>
  );
}
