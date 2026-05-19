import { ITreeItem } from '@/api';
import { useAppSelector } from '@/store';
import { Modal } from '@ctzhian/ui';
import { Box, Stack, TextField, Typography, alpha } from '@mui/material';
import { IconNeirongguanli } from '@panda-wiki/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { WrapContext } from '..';

interface DocReferenceModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (nodeId: string, title: string) => void;
}

/**
 * 文档引用弹窗
 * 支持从当前 wiki 目录树中选择文档，并输入引用标题
 */
const DocReferenceModal = ({
  open,
  onClose,
  onInsert,
}: DocReferenceModalProps) => {
  const { catalogData, groups, nav_id } = useOutletContext<WrapContext>();
  const { kb_id } = useAppSelector(state => state.config);

  const [selectedNode, setSelectedNode] = useState<ITreeItem | null>(null);
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');

  // 获取所有文档（扁平化目录树）
  const allDocs = useMemo(() => {
    const docs: ITreeItem[] = [];
    const collectDocs = (items: ITreeItem[]) => {
      for (const item of items) {
        if (item.type === 2) {
          docs.push(item);
        }
        if (item.children && item.children.length > 0) {
          collectDocs(item.children);
        }
      }
    };

    // 从所有分组中收集文档
    if (groups && groups.length > 0) {
      for (const group of groups) {
        if (group.list) {
          const treeItems = group.list.map((node: any) => ({
            id: node.id,
            name: node.name,
            type: node.type as 1 | 2,
            emoji: node.emoji || '',
            level: node.level || 0,
            parentId: node.parent_id || '',
            children: [],
          }));
          collectDocs(treeItems);
        }
      }
    } else {
      collectDocs(catalogData);
    }

    return docs;
  }, [catalogData, groups]);

  // 搜索过滤
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return allDocs;
    const keyword = search.toLowerCase();
    return allDocs.filter(doc => doc.name.toLowerCase().includes(keyword));
  }, [allDocs, search]);

  const handleSelect = useCallback(
    (doc: ITreeItem) => {
      setSelectedNode(doc);
      if (!title) {
        setTitle(doc.name);
      }
    },
    [title],
  );

  const handleConfirm = () => {
    if (!selectedNode) return;
    const displayTitle = title.trim() || selectedNode.name;
    onInsert(selectedNode.id, displayTitle);
    handleReset();
  };

  const handleReset = () => {
    setSelectedNode(null);
    setTitle('');
    setSearch('');
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setSelectedNode(null);
      setTitle('');
      setSearch('');
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={handleReset}
      title='插入文档引用'
      onOk={handleConfirm}
      okText='插入'
      okButtonProps={{ disabled: !selectedNode }}
      width={520}
    >
      <Stack gap={2} sx={{ mt: 1 }}>
        <TextField
          label='引用标题'
          placeholder='留空则使用文档标题'
          value={title}
          onChange={e => setTitle(e.target.value)}
          fullWidth
          size='small'
        />
        <TextField
          label='搜索文档'
          placeholder='输入文档名称搜索'
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
          size='small'
        />
        <Box
          sx={{
            maxHeight: 300,
            overflow: 'auto',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
          }}
        >
          {filteredDocs.length === 0 ? (
            <Typography
              sx={{
                p: 3,
                textAlign: 'center',
                color: 'text.tertiary',
                fontSize: 14,
              }}
            >
              暂无文档
            </Typography>
          ) : (
            filteredDocs.map(doc => (
              <Stack
                key={doc.id}
                direction='row'
                alignItems='center'
                gap={1}
                onClick={() => handleSelect(doc)}
                sx={theme => ({
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor:
                    selectedNode?.id === doc.id
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  },
                  '&:last-child': {
                    borderBottom: 'none',
                  },
                })}
              >
                {doc.emoji ? (
                  <Box sx={{ fontSize: 16, lineHeight: 1 }}>{doc.emoji}</Box>
                ) : (
                  <IconNeirongguanli
                    sx={{ fontSize: 14, color: 'text.tertiary' }}
                  />
                )}
                <Typography
                  sx={{
                    fontSize: 14,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: selectedNode?.id === doc.id ? 600 : 400,
                  }}
                >
                  {doc.name}
                </Typography>
                {selectedNode?.id === doc.id && (
                  <Box
                    sx={{
                      fontSize: 12,
                      color: 'primary.main',
                      flexShrink: 0,
                    }}
                  >
                    已选择
                  </Box>
                )}
              </Stack>
            ))
          )}
        </Box>
        {selectedNode && (
          <Typography sx={{ fontSize: 12, color: 'text.tertiary' }}>
            将引用文档：{selectedNode.name}（ID: {selectedNode.id.slice(0, 8)}
            ...）
          </Typography>
        )}
      </Stack>
    </Modal>
  );
};

export default DocReferenceModal;
