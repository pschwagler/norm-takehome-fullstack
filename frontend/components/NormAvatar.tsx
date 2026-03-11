import { Box } from '@chakra-ui/react';
import { BRAND_PURPLE } from '@/lib/colors';

interface NormAvatarProps {
  size?: string;
}

export default function NormAvatar({
  size = '36px',
}: NormAvatarProps): React.ReactNode {
  return (
    <Box
      w={size}
      h={size}
      minW={size}
      borderRadius="8px"
      overflow="hidden"
      flexShrink={0}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="23.875" fill={BRAND_PURPLE} />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M21.6746 70.3771L21.2949 68.6438C28.9967 56.3159 33.5326 41.8095 33.7636 26.2468L35.0229 24.9963L42.5229 24.9963L43.7646 26.247C43.5319 43.7937 38.4091 60.1737 29.6956 74.0706L27.9745 74.4467L21.6746 70.3771ZM53.7498 25H46.2498L44.9998 26.25V73.75L46.2498 75H53.7498L54.9998 73.75V26.25L53.7498 25ZM78.7278 31.3525L78.3481 29.6192L72.0483 25.5496L70.3272 25.9257C61.6137 39.8226 56.4909 56.2026 56.2582 73.7493L57.4999 75H64.9999L66.2591 73.7495C66.4901 58.1868 71.0261 43.6804 78.7278 31.3525Z"
          fill="white"
        />
      </svg>
    </Box>
  );
}
