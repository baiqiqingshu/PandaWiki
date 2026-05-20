import { postApiV1NodeImport, ImportResult } from '@/request/Export';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  Info,
  Cancel,
  InsertDriveFile,
  CloudUploadOutlined,
  Close,
} from '@mui/icons-material';
import { useCallback, useState } from 'react';
import { V1NavListResp } from '@/request/types';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  navList: V1NavListResp[];
  refresh: () => void;
}

const ImportDialog = ({
  open,
  onClose,
  navList,
  refresh,
}: ImportDialogProps) => {
  const kb_id = useAppSelector(state => state.config.kb_id);
  const [file, setFile] = useState<File | null>(null);
  const [navId, setNavId] = useState<string>('');
  const [conflictStrategy, setConflictStrategy] = useState<
    'skip' | 'overwrite' | 'rename'
  >('skip');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const f = files[0];
        if (!f.name.endsWith('.zip')) {
          message.error('请选择 .zip 文件');
          return;
        }
        setFile(f);
      }
    },
    [],
  );

  const handleImport = async () => {
    if (!kb_id || !file) return;
    setLoading(true);
    try {
      const res = await postApiV1NodeImport({
        file,
        kb_id,
        nav_id: navId || undefined,
        conflict_strategy: conflictStrategy,
      });
      setResult(res);
      message.success(
        `导入完成：成功 ${res.imported_count}，跳过 ${res.skipped_count}，失败 ${res.failed_count}`,
      );
      refresh();
    } catch (err: any) {
      message.error(err?.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setNavId('');
    setConflictStrategy('skip');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.08)',
          p: 1.5,
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant='h6' sx={{ fontWeight: 600, fontSize: 18 }}>
          导入文档
        </Typography>
        <IconButton size='small' onClick={handleClose} disabled={loading}>
          <Close sx={{ fontSize: 20 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {!result ? (
          <Stack spacing={3} sx={{ mt: 1.5 }}>
            {/* 文件选择 */}
            <Stack spacing={1}>
              <Typography
                variant='subtitle2'
                fontWeight={600}
                color='text.secondary'
              >
                选择文件
              </Typography>
              {!file ? (
                <Box
                  component='label'
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px dashed',
                    borderColor: 'divider',
                    borderRadius: '12px',
                    py: 4.5,
                    px: 2,
                    cursor: 'pointer',
                    bgcolor: 'background.paper3',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(25, 118, 210, 0.02)',
                    },
                  }}
                >
                  <CloudUploadOutlined
                    sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }}
                  />
                  <Typography
                    variant='body2'
                    fontWeight={500}
                    color='text.primary'
                  >
                    点击选择或拖拽 .zip 备份包文件
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.disabled'
                    sx={{ mt: 0.5 }}
                  >
                    支持包含 Markdown/HTML 文档的标准 Zip 包
                  </Typography>
                  <input
                    type='file'
                    accept='.zip'
                    hidden
                    onChange={handleFileChange}
                  />
                </Box>
              ) : (
                <Stack
                  direction='row'
                  alignItems='center'
                  justifyContent='space-between'
                  sx={{
                    p: 2,
                    border: '1px solid',
                    borderColor: 'success.light',
                    borderRadius: '12px',
                    bgcolor: 'rgba(76, 175, 80, 0.03)',
                  }}
                >
                  <Stack direction='row' alignItems='center' spacing={1.5}>
                    <InsertDriveFile
                      sx={{ color: 'success.main', fontSize: 24 }}
                    />
                    <Box>
                      <Typography
                        variant='body2'
                        fontWeight={600}
                        color='text.primary'
                      >
                        {file.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton
                    size='small'
                    color='error'
                    onClick={() => setFile(null)}
                  >
                    <Close sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              )}
            </Stack>

            {/* 目标目录 */}
            <Stack spacing={1}>
              <Typography
                variant='subtitle2'
                fontWeight={600}
                color='text.secondary'
              >
                目标导航目录（可选）
              </Typography>
              <Select
                size='small'
                value={navId}
                onChange={e => setNavId(e.target.value)}
                displayEmpty
                fullWidth
                sx={{ borderRadius: '10px' }}
              >
                <MenuItem value=''>
                  <em>按导出包自动还原</em>
                </MenuItem>
                {navList.map(nav => (
                  <MenuItem key={nav.id} value={nav.id || ''}>
                    {nav.name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>

            {/* 冲突策略 */}
            <Stack spacing={1}>
              <Typography
                variant='subtitle2'
                fontWeight={600}
                color='text.secondary'
              >
                冲突处理策略
              </Typography>
              <RadioGroup
                value={conflictStrategy}
                onChange={e =>
                  setConflictStrategy(
                    e.target.value as 'skip' | 'overwrite' | 'rename',
                  )
                }
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1.5,
                }}
              >
                {[
                  { value: 'skip', label: '跳过', desc: '不导入同名文档' },
                  { value: 'overwrite', label: '覆盖', desc: '更新同名文档' },
                  { value: 'rename', label: '重命名', desc: '追加时间后缀' },
                ].map(item => {
                  const active = conflictStrategy === item.value;
                  return (
                    <Box
                      key={item.value}
                      component='label'
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 1.5,
                        borderRadius: '10px',
                        border: '1.5px solid',
                        borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: active
                          ? 'rgba(25, 118, 210, 0.02)'
                          : 'background.paper',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: active
                            ? 'primary.main'
                            : 'text.secondary',
                        },
                      }}
                    >
                      <Radio
                        value={item.value}
                        size='small'
                        sx={{ display: 'none' }}
                      />
                      <Typography
                        variant='body2'
                        fontWeight={600}
                        color={active ? 'primary.main' : 'text.primary'}
                      >
                        {item.label}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        align='center'
                        sx={{ mt: 0.5, fontSize: '10px' }}
                      >
                        {item.desc}
                      </Typography>
                    </Box>
                  );
                })}
              </RadioGroup>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* Visual State Header */}
            <Stack
              direction='row'
              alignItems='center'
              spacing={2}
              sx={{ p: 0.5 }}
            >
              {result.failed_count === 0 ? (
                <CheckCircle sx={{ color: 'success.main', fontSize: 32 }} />
              ) : result.imported_count > 0 ? (
                <Info sx={{ color: 'warning.main', fontSize: 32 }} />
              ) : (
                <Cancel sx={{ color: 'error.main', fontSize: 32 }} />
              )}
              <Box>
                <Typography
                  variant='subtitle1'
                  sx={{ fontWeight: 600, fontSize: 16 }}
                >
                  {result.failed_count === 0
                    ? '文档导入完成'
                    : result.imported_count > 0
                      ? '文档部分导入成功'
                      : '文档导入失败'}
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  sx={{ fontSize: 12 }}
                >
                  共处理了{' '}
                  {result.imported_count +
                    result.skipped_count +
                    result.failed_count}{' '}
                  个文档节点
                </Typography>
              </Box>
            </Stack>

            {/* Statistics Cards */}
            <Stack direction='row' spacing={2}>
              <Box
                sx={{
                  flex: 1,
                  bgcolor: 'rgba(76, 175, 80, 0.04)',
                  border: '1px solid rgba(76, 175, 80, 0.15)',
                  borderRadius: '12px',
                  p: 1.5,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <Typography
                  variant='caption'
                  sx={{ color: 'success.main', fontWeight: 600, fontSize: 12 }}
                >
                  导入成功
                </Typography>
                <Typography
                  variant='h5'
                  sx={{ color: 'success.main', fontWeight: 700 }}
                >
                  {result.imported_count}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  bgcolor: 'rgba(255, 152, 0, 0.04)',
                  border: '1px solid rgba(255, 152, 0, 0.15)',
                  borderRadius: '12px',
                  p: 1.5,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <Typography
                  variant='caption'
                  sx={{ color: 'warning.main', fontWeight: 600, fontSize: 12 }}
                >
                  跳过同名
                </Typography>
                <Typography
                  variant='h5'
                  sx={{ color: 'warning.main', fontWeight: 700 }}
                >
                  {result.skipped_count}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  bgcolor: 'rgba(244, 67, 54, 0.04)',
                  border: '1px solid rgba(244, 67, 54, 0.15)',
                  borderRadius: '12px',
                  p: 1.5,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.25,
                }}
              >
                <Typography
                  variant='caption'
                  sx={{ color: 'error.main', fontWeight: 600, fontSize: 12 }}
                >
                  导入失败
                </Typography>
                <Typography
                  variant='h5'
                  sx={{ color: 'error.main', fontWeight: 700 }}
                >
                  {result.failed_count}
                </Typography>
              </Box>
            </Stack>

            {/* Detailed list of records */}
            {result.details.length > 0 && (
              <Stack spacing={1}>
                <Typography
                  variant='subtitle2'
                  fontWeight={600}
                  color='text.secondary'
                >
                  详细记录
                </Typography>
                <Stack
                  spacing={1}
                  sx={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '12px',
                    p: 1.5,
                    bgcolor: 'background.paper',
                    '&::-webkit-scrollbar': {
                      width: '6px',
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'transparent',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(0, 0, 0, 0.08)',
                      borderRadius: '3px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      background: 'rgba(0, 0, 0, 0.15)',
                    },
                  }}
                >
                  {result.details.map((d, i) => {
                    let statusColor = 'success.main';
                    let statusBg = 'rgba(76, 175, 80, 0.08)';
                    let statusIcon = (
                      <CheckCircle
                        sx={{ color: 'success.main', fontSize: 16 }}
                      />
                    );

                    if (d.status === 'skipped') {
                      statusColor = 'warning.main';
                      statusBg = 'rgba(255, 152, 0, 0.08)';
                      statusIcon = (
                        <Info sx={{ color: 'warning.main', fontSize: 16 }} />
                      );
                    } else if (d.status === 'failed') {
                      statusColor = 'error.main';
                      statusBg = 'rgba(244, 67, 54, 0.08)';
                      statusIcon = (
                        <Cancel sx={{ color: 'error.main', fontSize: 16 }} />
                      );
                    }

                    return (
                      <Stack
                        key={i}
                        direction='row'
                        alignItems='center'
                        justifyContent='space-between'
                        sx={{
                          p: '10px 14px',
                          borderRadius: '8px',
                          bgcolor: 'background.paper3',
                          border: '1px solid',
                          borderColor: 'transparent',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: 'divider',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                            transform: 'translateY(-1px)',
                          },
                        }}
                      >
                        <Stack
                          direction='row'
                          alignItems='center'
                          spacing={1.5}
                          sx={{ minWidth: 0 }}
                        >
                          {statusIcon}
                          <InsertDriveFile
                            sx={{
                              color: 'text.disabled',
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant='body2'
                            sx={{
                              fontWeight: 500,
                              color: 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '13px',
                            }}
                          >
                            {d.name}
                          </Typography>
                        </Stack>
                        {d.reason && (
                          <Box
                            sx={{
                              fontSize: '11px',
                              color: statusColor,
                              bgcolor: statusBg,
                              px: 1,
                              py: 0.25,
                              borderRadius: '6px',
                              fontWeight: 500,
                              ml: 1,
                              flexShrink: 0,
                            }}
                          >
                            {d.reason}
                          </Box>
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading} variant='outlined'>
              取消
            </Button>
            <Button
              variant='contained'
              onClick={handleImport}
              disabled={loading || !file}
            >
              {loading ? '导入中...' : '确认导入'}
            </Button>
          </>
        ) : (
          <Button
            variant='contained'
            onClick={handleClose}
            sx={{ minWidth: 100 }}
          >
            完成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;
