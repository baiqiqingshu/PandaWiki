import axios from 'axios';

const getToken = () => localStorage.getItem('panda_wiki_token') || '';
const getBaseURL = () => window.__BASENAME__ || '';

export interface ExportReq {
  kb_id: string;
  nav_id: string;
  format?: 'markdown' | 'html';
  include_assets?: boolean;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  details: { name: string; status: string; reason?: string }[];
  node_ids: string[];
}

/**
 * 导出节点为 zip 文件（直接触发下载）
 */
export const postApiV1NodeExport = async (data: ExportReq): Promise<void> => {
  const response = await axios({
    url: `${getBaseURL()}/api/v1/node/export`,
    method: 'POST',
    data,
    responseType: 'blob',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
  });

  // 从 Content-Disposition 中提取文件名
  const disposition = response.headers['content-disposition'];
  let filename = 'export.zip';
  if (disposition) {
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = decodeURIComponent(match[1]);
  }

  // 触发浏览器下载
  const blob = new Blob([response.data], { type: 'application/zip' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * 导入 zip 文件
 */
export const postApiV1NodeImport = async (params: {
  file: File;
  kb_id: string;
  nav_id?: string;
  conflict_strategy?: 'skip' | 'overwrite' | 'rename';
}): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('kb_id', params.kb_id);
  if (params.nav_id) formData.append('nav_id', params.nav_id);
  if (params.conflict_strategy)
    formData.append('conflict_strategy', params.conflict_strategy);

  const response = await axios({
    url: `${getBaseURL()}/api/v1/node/import`,
    method: 'POST',
    data: formData,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'multipart/form-data',
    },
  });

  const res = response.data;
  if (res.success) return res.data;
  throw new Error(res.message || '导入失败');
};
