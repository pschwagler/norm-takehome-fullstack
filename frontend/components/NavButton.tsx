import { Box, Tooltip, Button } from '@chakra-ui/react';
import Link from 'next/link';
import { useState } from 'react';
import {
  MdAdd,
  MdBugReport,
  MdCopyAll,
  MdDownload,
  MdOutlineHome,
  MdOutlineMenuBook,
  MdDelete,
  MdOutlineNotifications,
  MdModeEdit,
  MdAccountBalance,
} from 'react-icons/md';
import { IoArrowRedoOutline } from 'react-icons/io5';
import { IoIosSave } from 'react-icons/io';
import { RiOrganizationChart } from 'react-icons/ri';
import { AiOutlineAppstoreAdd } from 'react-icons/ai';
import { BsFileEarmarkPlayFill } from 'react-icons/bs';

export enum NavIconEnum {
  HOME = 'HOME',
  CREATE_PROJECT = 'CREATE_PROJECT',
  DOWNLOAD = 'DOWNLOAD',
  DEBUG = 'DEBUG',
  CLIPBOARD = 'CLIPBOARD',
  DELETE = 'DELETE',
  SHARE = 'SHARE',
  EDIT = 'EDIT',
  NOTIFICATIONS = 'NOTIFICATIONS',
  DOCUMENT = 'DOCUMENT',
  ARTIFACT = 'ARTIFACT',
  SAVE = 'SAVE',
  ORGANIZE = 'ORGANIZE',
  EVAL = 'EVAL',
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
  const color = isHovered ? '#2800D7' : '#5E6272';

  switch (navIconEnum) {
    case NavIconEnum.HOME:
      return <MdOutlineHome color={color} size="29px" />;
    case NavIconEnum.CREATE_PROJECT:
      return <MdAdd color={color} size="34.3px" />;
    case NavIconEnum.DOWNLOAD:
      return <MdDownload color={color} size="24px" />;
    case NavIconEnum.DEBUG:
      return <MdBugReport color={color} size="26px" />;
    case NavIconEnum.CLIPBOARD:
      return <MdCopyAll color={color} size="26px" />;
    case NavIconEnum.EDIT:
      return <MdModeEdit color={color} size="26px" />;
    case NavIconEnum.DELETE:
      return <MdDelete color={color} size="26px" />;
    case NavIconEnum.SHARE:
      return <IoArrowRedoOutline color={color} size="26px" />;
    case NavIconEnum.DOCUMENT:
      return <MdAccountBalance color={color} size="26px" />;
    case NavIconEnum.ARTIFACT:
      return <AiOutlineAppstoreAdd color={color} size="26px" />;
    case NavIconEnum.NOTIFICATIONS:
      return <MdOutlineNotifications color={color} size="26px" />;
    case NavIconEnum.SAVE:
      return <IoIosSave color={color} size="26px" />;
    case NavIconEnum.ORGANIZE:
      return <RiOrganizationChart color={color} size="26px" />;
    case NavIconEnum.EVAL:
      return <BsFileEarmarkPlayFill color={color} size="26px" />;
  }
}

export default function NavButton({
  onClick,
  linkPath,
  label,
  navIconEnum,
}: NavButtonProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
  const color = isHovered ? '#2800D7' : '#5E6272';

  if (linkPath && onClick) {
    throw new Error('NavButton cannot have both linkPath and onClick');
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
        fill={color}
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
