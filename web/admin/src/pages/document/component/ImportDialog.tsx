import { postApiV1NodeImport, ImportResult } from '@/request/Export';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
} from '@mui/material';
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
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
      <DialogTitle>导入文档</DialogTitle>
      <DialogContent>
        {!result ? (
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            {/* 文件选择 */}
            <Stack spacing={1}>
              <Typography variant='subtitle2'>选择文件</Typography>
              <Button
                variant='outlined'
                component='label'
                sx={{ alignSelf: 'flex-start' }}
              >
                {file ? file.name : '选择 .zip 文件'}
                <input
                  type='file'
                  accept='.zip'
                  hidden
                  onChange={handleFileChange}
                />
              </Button>
            </Stack>

            {/* 目标目录 */}
            <Stack spacing={1}>
              <Typography variant='subtitle2'>目标导航目录（可选）</Typography>
              <Select
                size='small'
                value={navId}
                onChange={e => setNavId(e.target.value)}
                displayEmpty
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
              <Typography variant='subtitle2'>冲突处理策略</Typography>
              <RadioGroup
                value={conflictStrategy}
                onChange={e =>
                  setConflictStrategy(
                    e.target.value as 'skip' | 'overwrite' | 'rename',
                  )
                }
              >
                <FormControlLabel
                  value='skip'
                  control={<Radio size='small' />}
                  label='跳过（同名文档不导入）'
                />
                <FormControlLabel
                  value='overwrite'
                  control={<Radio size='small' />}
                  label='覆盖（更新同名文档内容）'
                />
                <FormControlLabel
                  value='rename'
                  control={<Radio size='small' />}
                  label='重命名（追加时间戳后缀）'
                />
              </RadioGroup>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant='subtitle1' fontWeight={600}>
              导入结果
            </Typography>
            <Stack direction='row' spacing={2}>
              <Chip
                label={`成功 ${result.imported_count}`}
                color='success'
                size='small'
              />
              <Chip
                label={`跳过 ${result.skipped_count}`}
                color='warning'
                size='small'
              />
              <Chip
                label={`失败 ${result.failed_count}`}
                color='error'
                size='small'
              />
            </Stack>
            {result.details.length > 0 && (
              <Stack
                spacing={0.5}
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                {result.details.map((d, i) => (
                  <Typography key={i} variant='body2' sx={{ fontSize: 12 }}>
                    {d.status === 'imported' && '✅'}
                    {d.status === 'skipped' && '⏭️'}
                    {d.status === 'failed' && '❌'} {d.name}
                    {d.reason && (
                      <Typography
                        component='span'
                        variant='body2'
                        color='text.secondary'
                        sx={{ fontSize: 12, ml: 0.5 }}
                      >
                        ({d.reason})
                      </Typography>
                    )}
                  </Typography>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>
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
          <Button variant='contained' onClick={handleClose}>
            完成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;
