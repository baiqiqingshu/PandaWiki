import {
  getApiV1ModelSearchMode,
  putApiV1ModelSearchMode,
} from '@/request/Model';
import { message } from '@ctzhian/ui';
import {
  Box,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { FormItem, SettingCardItem } from './Common';

const CardSearchMode = () => {
  const [mode, setMode] = useState<string>('fts');
  const [loading, setLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const fetchSearchMode = async () => {
    try {
      const res = await getApiV1ModelSearchMode();
      setMode(res?.mode || 'fts');
    } catch {
      // 默认 fts
      setMode('fts');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await putApiV1ModelSearchMode({ mode });
      message.success('保存成功');
      setIsEdit(false);
    } catch {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearchMode();
  }, []);

  return (
    <Box
      sx={{
        width: 1000,
        margin: 'auto',
        pb: 4,
      }}
    >
      <SettingCardItem
        title='文档搜索方案'
        isEdit={isEdit}
        onSubmit={handleSave}
      >
        <FormItem label='检索技术方案'>
          <RadioGroup
            row
            value={mode}
            onChange={e => {
              setMode(e.target.value);
              setIsEdit(true);
            }}
          >
            <FormControlLabel
              value='fts'
              control={<Radio size='small' />}
              label={
                <Box>
                  <Typography variant='body2' fontWeight={500}>
                    PostgreSQL 全文检索
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    基于 PG 内置分词，无需额外模型，适合中小规模文档
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value='vector'
              control={<Radio size='small' />}
              label={
                <Box>
                  <Typography variant='body2' fontWeight={500}>
                    向量模型检索
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    基于 Embedding 模型语义匹配，需配置向量模型
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormItem>

        {mode === 'vector' && (
          <FormItem label=''>
            <Typography variant='caption' color='warning.main'>
              使用向量检索需要在系统设置中配置 Embedding
              模型，否则将自动回退到全文检索。
            </Typography>
          </FormItem>
        )}
      </SettingCardItem>
    </Box>
  );
};

export default CardSearchMode;
