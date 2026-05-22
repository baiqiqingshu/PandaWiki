import { ITreeItem } from '@/api';
import { getApiV1NodeDetail } from '@/request/Node';
import { useAppSelector } from '@/store';
import { Modal } from '@ctzhian/ui';
import { Box, Stack, TextField, Typography, alpha } from '@mui/material';
import { IconNeirongguanli } from '@panda-wiki/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { WrapContext } from '..';

interface DocReferenceModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (nodeId: string, title: string, headingText?: string) => void;
}

interface DocHeading {
  level: number;
  text: string;
  /** 原文档中第 N 个 heading，便于 React key 与去重 */
  index: number;
}

/**
 * 从 HTML 字符串中解析出 h1-h6 列表。
 * 顺序与原文一致；忽略空文本。
 */
const parseHeadings = (html: string): DocHeading[] => {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const els = doc.querySelectorAll('h1,h2,h3,h4,h5,h6');
    const result: DocHeading[] = [];
    els.forEach((el, idx) => {
      const text = (el.textContent || '').trim();
      if (!text) return;
      const level = Number(el.tagName.substring(1)) || 1;
      result.push({ level, text, index: idx });
    });
    return result;
  } catch {
    return [];
  }
};

/**
 * 文档引用弹窗
 * 支持从当前 wiki 目录树中选择文档，并可选定该文档内的某个章节（heading），
 * 插入到正文后链接会附带 hash 锚点，用户端访问时可滚动到对应章节。
 */
const DocReferenceModal = ({
  open,
  onClose,
  onInsert,
}: DocReferenceModalProps) => {
  const { catalogData, groups } = useOutletContext<WrapContext>();
  const { kb_id } = useAppSelector(state => state.config);

  const [selectedNode, setSelectedNode] = useState<ITreeItem | null>(null);
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');

  // 章节相关
  const [headings, setHeadings] = useState<DocHeading[]>([]);
  const [selectedHeading, setSelectedHeading] = useState<DocHeading | null>(
    null,
  );
  const [headingLoading, setHeadingLoading] = useState(false);
  const [headingError, setHeadingError] = useState(false);
  // 用于忽略过期响应（用户快速切换文档时，避免旧响应覆盖新选择）
  const headingRequestTokenRef = useRef(0);

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

  // 选定文档后懒加载内容并解析 heading
  useEffect(() => {
    if (!selectedNode || !kb_id) {
      setHeadings([]);
      setSelectedHeading(null);
      setHeadingError(false);
      setHeadingLoading(false);
      return;
    }
    const token = ++headingRequestTokenRef.current;
    setHeadings([]);
    setSelectedHeading(null);
    setHeadingError(false);
    setHeadingLoading(true);
    getApiV1NodeDetail({ id: selectedNode.id, kb_id })
      .then(res => {
        if (token !== headingRequestTokenRef.current) return;
        setHeadings(parseHeadings(res?.content || ''));
        setHeadingLoading(false);
      })
      .catch(() => {
        if (token !== headingRequestTokenRef.current) return;
        setHeadingError(true);
        setHeadingLoading(false);
      });
  }, [selectedNode, kb_id]);

  // 章节缩进基准
  const minHeadingLevel = useMemo(() => {
    if (headings.length === 0) return 1;
    return headings.reduce((min, h) => Math.min(min, h.level), 6);
  }, [headings]);

  const handleConfirm = () => {
    if (!selectedNode) return;
    const displayTitle = title.trim() || selectedNode.name;
    onInsert(selectedNode.id, displayTitle, selectedHeading?.text);
    handleReset();
  };

  const handleReset = () => {
    setSelectedNode(null);
    setTitle('');
    setSearch('');
    setHeadings([]);
    setSelectedHeading(null);
    setHeadingError(false);
    setHeadingLoading(false);
    headingRequestTokenRef.current++;
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setSelectedNode(null);
      setTitle('');
      setSearch('');
      setHeadings([]);
      setSelectedHeading(null);
      setHeadingError(false);
      setHeadingLoading(false);
      headingRequestTokenRef.current++;
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
            maxHeight: 240,
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
          <Stack gap={0.5}>
            <Typography sx={{ fontSize: 12, color: 'text.tertiary' }}>
              文档章节（可选，留空则引用整篇文档）
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
              }}
            >
              {/* 引用整篇文档（始终在最上） */}
              <Stack
                direction='row'
                alignItems='center'
                gap={1}
                onClick={() => setSelectedHeading(null)}
                sx={theme => ({
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: !selectedHeading
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  },
                })}
              >
                <Box sx={{ fontSize: 14, lineHeight: 1 }}>📄</Box>
                <Typography
                  sx={{
                    fontSize: 14,
                    flex: 1,
                    fontWeight: !selectedHeading ? 600 : 400,
                  }}
                >
                  引用整篇文档（默认）
                </Typography>
                {!selectedHeading && (
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

              {headingLoading && (
                <Typography
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    color: 'text.tertiary',
                    fontSize: 13,
                  }}
                >
                  加载章节中…
                </Typography>
              )}
              {!headingLoading && headingError && (
                <Typography
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    color: 'error.main',
                    fontSize: 13,
                  }}
                >
                  无法加载章节，请稍后重试
                </Typography>
              )}
              {!headingLoading && !headingError && headings.length === 0 && (
                <Typography
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    color: 'text.tertiary',
                    fontSize: 13,
                  }}
                >
                  该文档暂无目录
                </Typography>
              )}
              {!headingLoading &&
                !headingError &&
                headings.map(h => {
                  const isActive =
                    selectedHeading?.index === h.index &&
                    selectedHeading?.text === h.text;
                  const indent = (h.level - minHeadingLevel) * 16;
                  return (
                    <Stack
                      key={`${h.index}-${h.text}`}
                      direction='row'
                      alignItems='center'
                      gap={1}
                      onClick={() => setSelectedHeading(h)}
                      sx={theme => ({
                        px: 2,
                        py: 0.75,
                        pl: `${16 + indent}px`,
                        cursor: 'pointer',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        bgcolor: isActive
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
                      <Box
                        sx={{
                          fontSize: 12,
                          color: 'text.tertiary',
                          fontFamily: 'monospace',
                          flexShrink: 0,
                          width: 24,
                        }}
                      >
                        {'#'.repeat(h.level)}
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 14,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        {h.text}
                      </Typography>
                      {isActive && (
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
                  );
                })}
            </Box>
          </Stack>
        )}

        {selectedNode && (
          <Typography sx={{ fontSize: 12, color: 'text.tertiary' }}>
            将引用文档：{selectedNode.name}
            {selectedHeading ? ` · ${selectedHeading.text}` : ''}（ID:{' '}
            {selectedNode.id.slice(0, 8)}
            ...）
          </Typography>
        )}
      </Stack>
    </Modal>
  );
};

export default DocReferenceModal;
