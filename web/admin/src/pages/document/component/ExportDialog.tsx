import { postApiV1NodeExport } from '@/request/Export';
import { useAppSelector } from '@/store';
import { message } from '@ctzhian/ui';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  navId: string;
  navName: string;
  nodeCount: number;
}

const ExportDialog = ({
  open,
  onClose,
  navId,
  navName,
  nodeCount,
}: ExportDialogProps) => {
  const kb_id = useAppSelector(state => state.config.kb_id);
  const [format, setFormat] = useState<'markdown' | 'html'>('markdown');
  const [includeAssets, setIncludeAssets] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!kb_id || !navId) return;
    setLoading(true);
    try {
      await postApiV1NodeExport({
        kb_id,
        nav_id: navId,
        format,
        include_assets: includeAssets,
      });
      message.success('导出成功');
      onClose();
    } catch {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>批量导出</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            将导出目录「{navName}」下的所有文档（共 {nodeCount} 个）
          </Typography>

          <Stack spacing={1}>
            <Typography variant='subtitle2'>导出格式</Typography>
            <RadioGroup
              row
              value={format}
              onChange={e => setFormat(e.target.value as 'markdown' | 'html')}
            >
              <FormControlLabel
                value='markdown'
                control={<Radio size='small' />}
                label='Markdown'
              />
              <FormControlLabel
                value='html'
                control={<Radio size='small' />}
                label='HTML'
              />
            </RadioGroup>
          </Stack>

          <FormControlLabel
            control={
              <Checkbox
                checked={includeAssets}
                onChange={e => setIncludeAssets(e.target.checked)}
                size='small'
              />
            }
            label='包含图片资源'
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button
          variant='contained'
          onClick={handleExport}
          disabled={loading || !navId}
        >
          {loading ? '导出中...' : '确认导出'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;
