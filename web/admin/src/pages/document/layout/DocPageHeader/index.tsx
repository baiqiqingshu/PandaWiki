import Card from '@/components/Card';
import { getApiV1NodeStats } from '@/request/Node';
import { useAppSelector } from '@/store';
import { Box, Button, ButtonBase, Stack } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import DocSearch from './DocSearch';

interface DocPageHeaderProps {
  onPublishClick: () => void;
  onRagClick: () => void;
  onExportClick?: () => void;
  onImportClick?: () => void;
  /** 变更时触发重新拉取统计 */
  refreshTrigger?: number;
}

const DocPageHeader = ({
  onPublishClick,
  onRagClick,
  onExportClick,
  onImportClick,
  refreshTrigger,
}: DocPageHeaderProps) => {
  const { kb_id, isRefreshDocList } = useAppSelector(state => state.config);
  const [stats, setStats] = useState({
    unreleased_nav_count: 0,
    unpublished_count: 0,
    unstudied_count: 0,
  });

  const getStats = useCallback(() => {
    if (!kb_id) return;
    getApiV1NodeStats({ kb_id }).then(res => {
      if (res) {
        setStats({
          unreleased_nav_count: res.unreleased_nav_count ?? 0,
          unpublished_count: res.unpublished_count ?? 0,
          unstudied_count: res.unstudied_count ?? 0,
        });
      }
    });
  }, [kb_id]);

  useEffect(() => {
    if (kb_id) getStats();
  }, [kb_id, getStats]);

  useEffect(() => {
    if (isRefreshDocList) getStats();
  }, [isRefreshDocList, getStats]);

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) getStats();
  }, [refreshTrigger, getStats]);

  return (
    <Card>
      <Stack
        direction={'row'}
        alignItems={'center'}
        justifyContent={'space-between'}
        sx={{ p: 2 }}
      >
        <Stack
          direction={'row'}
          alignItems={'center'}
          gap={0}
          sx={{ fontSize: 16, fontWeight: 700 }}
        >
          <Box>目录</Box>
          {(stats.unpublished_count > 0 || stats.unreleased_nav_count > 0) && (
            <>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={0}
                sx={{ ml: 2 }}
              >
                {stats.unreleased_nav_count > 0 && (
                  <Box
                    sx={{
                      color: 'error.main',
                      fontSize: 12,
                      fontWeight: 'normal',
                    }}
                  >
                    {stats.unreleased_nav_count} 个 目录未发布，
                  </Box>
                )}
                {stats.unpublished_count > 0 && (
                  <Box
                    sx={{
                      color: 'error.main',
                      fontSize: 12,
                      fontWeight: 'normal',
                    }}
                  >
                    {stats.unpublished_count} 个 文档/文件夹未发布，
                  </Box>
                )}
              </Stack>
              <ButtonBase
                disableRipple
                sx={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'primary.main',
                }}
                onClick={onPublishClick}
              >
                去发布
              </ButtonBase>
            </>
          )}
          {stats.unstudied_count > 0 && (
            <>
              <Box
                sx={{
                  color: 'error.main',
                  fontSize: 12,
                  fontWeight: 'normal',
                  ml: 2,
                }}
              >
                {stats.unstudied_count} 个文档未学习，
              </Box>
              <ButtonBase
                disableRipple
                sx={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: 'primary.main',
                }}
                onClick={onRagClick}
              >
                去学习
              </ButtonBase>
            </>
          )}
        </Stack>
        <Stack direction='row' alignItems='center' gap={1}>
          {onExportClick && (
            <Button
              size='small'
              variant='outlined'
              onClick={onExportClick}
              sx={{ fontSize: 12, whiteSpace: 'nowrap' }}
            >
              导出
            </Button>
          )}
          {onImportClick && (
            <Button
              size='small'
              variant='outlined'
              onClick={onImportClick}
              sx={{ fontSize: 12, whiteSpace: 'nowrap' }}
            >
              导入
            </Button>
          )}
          <DocSearch />
        </Stack>
      </Stack>
    </Card>
  );
};

export default DocPageHeader;
