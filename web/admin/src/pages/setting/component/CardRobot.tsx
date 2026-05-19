import { DomainKnowledgeBaseDetail } from '@/request/types';
import { Box } from '@mui/material';
import CardRobotWebComponent from './CardRobot/WebComponent';
import CardRobotApi from './CardRobotApi';

const CardRobot = ({
  kb,
  url,
}: {
  kb: DomainKnowledgeBaseDetail;
  url: string;
}) => {
  return (
    <Box
      sx={{
        width: 1000,
        margin: 'auto',
        pb: 4,
      }}
    >
      <CardRobotWebComponent kb={kb} />
      <CardRobotApi kb={kb} url={url} />
    </Box>
  );
};

export default CardRobot;
