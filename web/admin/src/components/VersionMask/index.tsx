import { VersionInfoMap } from '@/constant/version';
import { useVersionInfo } from '@/hooks';
import { ConstsLicenseEdition } from '@/request/types';
import { styled, SxProps, Tooltip } from '@mui/material';
import React from 'react';

const StyledMaskWrapper = styled('div')(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

const StyledMask = styled('div')(({ theme }) => ({
  position: 'absolute',
  inset: -8,
  zIndex: 99,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flex: 1,
  borderRadius: '10px',
  border: `1px solid ${theme.palette.divider}`,
  background: 'rgba(241,242,248,0.8)',
  backdropFilter: 'blur(0.5px)',
}));

const StyledMaskContent = styled('div')(({ theme }) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledMaskVersion = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  backgroundColor: theme.palette.background.paper3,
  borderRadius: '10px',
  fontSize: 12,
  lineHeight: 1,
  color: theme.palette.light.main,
}));

const VersionMask = ({
  children,
}: {
  permission?: ConstsLicenseEdition[];
  children?: React.ReactNode;
  wrapperSx?: SxProps;
  sx?: SxProps;
}) => {
  // 自部署版本：跳过版本权限检查，直接渲染子组件
  return children;
};

export const VersionCanUse = ({}: {
  permission?: ConstsLicenseEdition[];
  sx?: SxProps;
  mode?: 'icon' | 'text';
}) => {
  // 自部署版本：不显示版本限制提示
  return null;
};

export default VersionMask;
