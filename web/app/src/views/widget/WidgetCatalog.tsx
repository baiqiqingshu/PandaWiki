'use client';
import { ITreeItem } from '@/assets/type';
import { useBasePath } from '@/hooks';
import { getShareV1NodeList } from '@/request/ShareNode';
import {
  convertToTree,
  filterEmptyFolders,
  parseNodeListResponse,
  type NavItem,
} from '@/utils/tree';
import { Ellipsis } from '@ctzhian/ui';
import {
  alpha,
  Box,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  useTheme,
} from '@mui/material';
import { IconWenjian, IconWenjianjia, IconXiajiantou } from '@panda-wiki/icons';
import { useEffect, useMemo, useState } from 'react';

interface WidgetCatalogItemProps {
  item: ITreeItem;
  depth: number;
  basePath: string;
  expandedMap: Record<string, boolean>;
  onToggle: (id: string) => void;
}

/** 单个目录/文件节点，递归渲染 */
const WidgetCatalogItem = ({
  item,
  depth,
  basePath,
  expandedMap,
  onToggle,
}: WidgetCatalogItemProps) => {
  const theme = useTheme();
  const isFolder = item.type === 1;
  const expanded = expandedMap[item.id] ?? false;

  const handleClick = () => {
    if (isFolder) {
      onToggle(item.id);
    } else {
      // 文件：在父窗口打开文档详情页
      const url = `${basePath}/node/${item.id}`;
      window.open(url, '_blank');
    }
  };

  return (
    <Stack gap={0.5}>
      <Stack
        direction='row'
        alignItems='center'
        gap={1}
        onClick={handleClick}
        sx={{
          minHeight: 36,
          pr: 1,
          pl: depth * 1.5 + 1,
          borderRadius: '8px',
          cursor: 'pointer',
          color: 'text.primary',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.06),
          },
        }}
      >
        {isFolder ? (
          <IconXiajiantou
            sx={{
              flexShrink: 0,
              fontSize: 16,
              color: 'text.tertiary',
              transform: expanded ? 'none' : 'rotate(-90deg)',
              transition: 'transform 0.2s',
            }}
          />
        ) : (
          <Box sx={{ width: 16, flexShrink: 0 }} />
        )}
        {item.emoji ? (
          <Box sx={{ flexShrink: 0, fontSize: 14 }}>{item.emoji}</Box>
        ) : isFolder ? (
          <IconWenjianjia sx={{ flexShrink: 0, fontSize: 14 }} />
        ) : (
          <IconWenjian sx={{ flexShrink: 0, fontSize: 14 }} />
        )}
        <Ellipsis sx={{ flex: 1, width: 0, fontSize: 14 }}>
          {item.name}
        </Ellipsis>
      </Stack>
      {isFolder && expanded && item.children && item.children.length > 0 && (
        <Stack gap={0.5}>
          {item.children.map(child => (
            <WidgetCatalogItem
              key={child.id}
              item={child}
              depth={depth + 1}
              basePath={basePath}
              expandedMap={expandedMap}
              onToggle={onToggle}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

const CatalogSkeleton = () => (
  <Stack gap={1} sx={{ mt: 1 }}>
    {[...Array(5)].map((_, i) => (
      <Skeleton key={i} variant='rounded' height={32} />
    ))}
  </Stack>
);

/**
 * 网页挂件文档目录组件。
 * 拉取知识库节点列表，构建目录树，支持目录展开/折叠、点击文件跳转到文档页。
 * 多栏目时顶部展示栏目切换标签。
 */
const WidgetCatalog = () => {
  const basePath = useBasePath();
  const [loading, setLoading] = useState(true);
  const [navList, setNavList] = useState<NavItem[]>([]);
  const [navDataMap, setNavDataMap] = useState<
    Record<string, ReturnType<typeof convertToTree>>
  >({});
  const [selectedNavId, setSelectedNavId] = useState<string>('');
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getShareV1NodeList()
      .then((res: any) => {
        if (!mounted) return;
        const data = res?.data ?? res;
        const parsed = parseNodeListResponse(data);
        const treeMap: Record<string, ReturnType<typeof convertToTree>> = {};
        Object.entries(parsed.navDataMap).forEach(([navId, list]) => {
          treeMap[navId] = filterEmptyFolders(convertToTree(list));
        });
        setNavList(parsed.navList);
        setNavDataMap(treeMap);
        setSelectedNavId(parsed.defaultNavId ?? '');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const currentTree = useMemo(() => {
    return navDataMap[selectedNavId] || [];
  }, [navDataMap, selectedNavId]);

  const handleToggle = (id: string) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasNavTabs = navList.length > 1;

  if (loading) {
    return <CatalogSkeleton />;
  }

  if (currentTree.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 1 }}>
      {hasNavTabs && (
        <Tabs
          value={selectedNavId}
          onChange={(_, value) => setSelectedNavId(value)}
          variant='scrollable'
          scrollButtons={false}
          sx={{
            minHeight: 'auto',
            mb: 1,
            '& .MuiTab-root': {
              minHeight: 'auto',
              py: 1,
              px: 1.5,
              fontSize: 13,
              textTransform: 'none',
            },
          }}
        >
          {navList.map(nav => (
            <Tab key={nav.id} value={nav.id} label={nav.name} />
          ))}
        </Tabs>
      )}
      <Stack
        gap={0.5}
        sx={{
          overflow: 'auto',
          maxHeight: 'calc(100vh - 220px)',
        }}
      >
        {currentTree.map(item => (
          <WidgetCatalogItem
            key={item.id}
            item={item}
            depth={0}
            basePath={basePath}
            expandedMap={expandedMap}
            onToggle={handleToggle}
          />
        ))}
      </Stack>
    </Box>
  );
};

export default WidgetCatalog;
