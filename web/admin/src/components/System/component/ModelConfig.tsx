import ErrorJSON from '@/assets/json/error.json';
import Card from '@/components/Card';
import { ModelProvider } from '@/constant/enums';
import { putApiV1Model } from '@/request/Model';
import { GithubComChaitinPandaWikiDomainModelListItem } from '@/request/types';
import { addOpacityToColor } from '@/utils';
import { message, Modal } from '@ctzhian/ui';
import { Box, Button, Stack, Switch, useTheme } from '@mui/material';
import LottieIcon from '../../LottieIcon';
import {
  useState,
  useEffect,
  lazy,
  Suspense,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import {
  convertLocalModelToUIModel,
  modelService,
} from '@/services/modelService';

const ModelModal = lazy(() =>
  import('@ctzhian/modelkit').then(
    (mod: typeof import('@ctzhian/modelkit')) => ({ default: mod.ModelModal }),
  ),
);

export interface ModelConfigRef {
  handleClose: () => void;
}

interface ModelConfigProps {
  onCloseModal: () => void;
  chatModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  embeddingModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  rerankModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  analysisModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  analysisVLModelData: GithubComChaitinPandaWikiDomainModelListItem | null;
  getModelList: () => void;
  showSaveBtn?: boolean;
}

const ModelConfig = forwardRef<ModelConfigRef, ModelConfigProps>(
  (props, ref) => {
    const theme = useTheme();
    const {
      onCloseModal,
      chatModelData,
      embeddingModelData,
      rerankModelData,
      analysisModelData,
      analysisVLModelData,
      getModelList,
      showSaveBtn = true,
    } = props;

    const [modelData, setModelData] = useState<Record<string, any>>({
      chat: chatModelData,
      embedding: embeddingModelData,
      rerank: rerankModelData,
      analysis: analysisModelData,
      'analysis-vl': analysisVLModelData,
    });

    const cacheModelData = useRef<Record<string, any>>({});

    const [addOpen, setAddOpen] = useState(false);
    const [addType, setAddType] = useState<
      'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl'
    >('chat');
    const [openingAdd, setOpeningAdd] = useState<
      'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl' | null
    >(null);

    const handleOpenAdd = async (
      type: 'chat' | 'embedding' | 'rerank' | 'analysis' | 'analysis-vl',
    ) => {
      try {
        setOpeningAdd(type);
        // 预加载 modal 代码分块，避免首次打开白屏
        await import('@ctzhian/modelkit');
        setAddType(type);
        setAddOpen(true);
      } finally {
        setOpeningAdd(null);
      }
    };

    const getProcessedUrl = (
      baseUrl: string,
      provider: keyof typeof ModelProvider,
    ) => {
      if (!ModelProvider[provider]?.urlWrite) {
        return baseUrl;
      }
      if (baseUrl.endsWith('#')) {
        return baseUrl;
      }
      const forceUseOriginalHost = () => {
        if (baseUrl.endsWith('/')) {
          baseUrl = baseUrl.slice(0, -1);
          return true;
        }
        if (/\/v\d+$/.test(baseUrl)) {
          return true;
        }
        return baseUrl.endsWith('volces.com/api/v3');
      };

      return forceUseOriginalHost() ? baseUrl : `${baseUrl}/v1`;
    };

    // 处理关闭弹窗
    const handleCloseModal = () => {
      onCloseModal();
    };

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      handleClose: handleCloseModal,
    }));

    useEffect(() => {
      setModelData({
        chat: chatModelData,
        embedding: embeddingModelData,
        rerank: rerankModelData,
        analysis: analysisModelData,
        'analysis-vl': analysisVLModelData,
      });
    }, [
      chatModelData,
      embeddingModelData,
      rerankModelData,
      analysisModelData,
      analysisVLModelData,
    ]);

    const IconModel = modelData.chat
      ? ModelProvider[modelData.chat.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconEmbeddingModel = modelData.embedding
      ? ModelProvider[
          modelData.embedding.provider as keyof typeof ModelProvider
        ].icon
      : null;

    const IconRerankModel = modelData.rerank
      ? ModelProvider[modelData.rerank.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconAnalysisModel = modelData.analysis
      ? ModelProvider[modelData.analysis.provider as keyof typeof ModelProvider]
          .icon
      : null;

    const IconAnalysisVLModel = modelData['analysis-vl']
      ? ModelProvider[
          modelData['analysis-vl'].provider as keyof typeof ModelProvider
        ].icon
      : null;

    const modelModalChatData = useMemo(() => {
      return convertLocalModelToUIModel(modelData.chat);
    }, [modelData.chat]);

    const modelModalEmbeddingData = useMemo(() => {
      return convertLocalModelToUIModel(modelData.embedding);
    }, [modelData.embedding]);

    const modelModalRerankData = useMemo(() => {
      return convertLocalModelToUIModel(modelData.rerank);
    }, [modelData.rerank]);

    const modelModalAnalysisData = useMemo(() => {
      return convertLocalModelToUIModel(modelData.analysis);
    }, [modelData.analysis]);

    const modelModalAnalysisVLData = useMemo(() => {
      return convertLocalModelToUIModel(modelData['analysis-vl']);
    }, [modelData['analysis-vl']]);

    return (
      <Stack gap={0}>
        <Box
          sx={{
            pl: 2,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                color: 'text.primary',
                mb: '16px',
              }}
            >
              <Box
                sx={{
                  width: 4,
                  height: 10,
                  bgcolor: 'primary.main',
                  borderRadius: '30%',
                  mr: 1,
                }}
              />
              模型配置
            </Box>
          </Box>
        </Box>
        {/* Chat */}
        <Card
          sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={1}
                sx={{ width: 500 }}
              >
                {modelData.chat ? (
                  <>
                    {IconModel && <IconModel sx={{ fontSize: 18 }} />}
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'text.tertiary',
                      }}
                    >
                      {ModelProvider[
                        modelData.chat.provider as keyof typeof ModelProvider
                      ].cn ||
                        ModelProvider[
                          modelData.chat.provider as keyof typeof ModelProvider
                        ].label ||
                        '其他'}
                      &nbsp;&nbsp;/
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      {modelData.chat.model}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        color: 'primary.main',
                      }}
                    >
                      智能对话模型
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontFamily: 'Gbold',
                      ml: -0.5,
                    }}
                  >
                    智能对话模型
                  </Box>
                )}
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  大模型
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                  }}
                >
                  可选
                </Box>
              </Stack>
              <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                在
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能问答{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  摘要生成{' '}
                </Box>
                过程中使用。
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
              {modelData.chat ? (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  状态正常
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  可选配置
                </Box>
              )}
            </Box>
            <Button
              size='small'
              variant='outlined'
              loading={openingAdd === 'chat'}
              onClick={() => handleOpenAdd('chat')}
            >
              {modelData.chat ? '修改' : '配置'}
            </Button>
          </Stack>
        </Card>

        {/* Embedding */}
        <Card
          sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={1}
                sx={{ width: 500 }}
              >
                {modelData.embedding ? (
                  <>
                    {IconEmbeddingModel && (
                      <IconEmbeddingModel sx={{ fontSize: 18 }} />
                    )}

                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'text.tertiary',
                      }}
                    >
                      {ModelProvider[
                        modelData.embedding
                          .provider as keyof typeof ModelProvider
                      ].cn ||
                        ModelProvider[
                          modelData.embedding
                            .provider as keyof typeof ModelProvider
                        ].label ||
                        '其他'}
                      &nbsp;&nbsp;/
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      {modelData.embedding.model}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        color: 'primary.main',
                      }}
                    >
                      向量模型
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontFamily: 'Gbold',
                      ml: -0.5,
                    }}
                  >
                    向量模型
                  </Box>
                )}
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  小模型
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                  }}
                >
                  可选
                </Box>
              </Stack>
              <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                在
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  内容发布{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能问答{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能搜索{' '}
                </Box>
                过程中使用。
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
              {modelData.embedding ? (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  状态正常
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  可选配置
                </Box>
              )}
            </Box>
            <Button
              size='small'
              variant='outlined'
              loading={openingAdd === 'embedding'}
              onClick={() => handleOpenAdd('embedding')}
            >
              {modelData.embedding ? '修改' : '配置'}
            </Button>
          </Stack>
        </Card>

        {/* Rerank */}
        <Card
          sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={1}
                sx={{ width: 500 }}
              >
                {modelData.rerank ? (
                  <>
                    {IconRerankModel && (
                      <IconRerankModel sx={{ fontSize: 18 }} />
                    )}

                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'text.tertiary',
                      }}
                    >
                      {ModelProvider[
                        modelData.rerank.provider as keyof typeof ModelProvider
                      ].cn ||
                        ModelProvider[
                          modelData.rerank
                            .provider as keyof typeof ModelProvider
                        ].label ||
                        '其他'}
                      &nbsp;&nbsp;/
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      {modelData.rerank.model}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        color: 'primary.main',
                      }}
                    >
                      重排序模型
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontFamily: 'Gbold',
                      ml: -0.5,
                    }}
                  >
                    重排序模型
                  </Box>
                )}
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  小模型
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                  }}
                >
                  可选
                </Box>
              </Stack>
              <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                在
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能问答{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能搜索{' '}
                </Box>
                过程中使用。
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
              {modelData.rerank ? (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  状态正常
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  可选配置
                </Box>
              )}
            </Box>
            <Button
              size='small'
              variant='outlined'
              loading={openingAdd === 'rerank'}
              onClick={() => handleOpenAdd('rerank')}
            >
              {modelData.rerank ? '修改' : '配置'}
            </Button>
          </Stack>
        </Card>

        {/* Analysis */}
        <Card
          sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={1}
                sx={{ width: 500 }}
              >
                {modelData.analysis ? (
                  <>
                    {IconAnalysisModel && (
                      <IconAnalysisModel sx={{ fontSize: 18 }} />
                    )}

                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'text.tertiary',
                      }}
                    >
                      {ModelProvider[
                        modelData.analysis
                          .provider as keyof typeof ModelProvider
                      ].cn ||
                        ModelProvider[
                          modelData.analysis
                            .provider as keyof typeof ModelProvider
                        ].label ||
                        '其他'}
                      &nbsp;&nbsp;/
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      {modelData.analysis.model}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        color: 'primary.main',
                      }}
                    >
                      文档分析模型
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontFamily: 'Gbold',
                      ml: -0.5,
                    }}
                  >
                    文档分析模型
                  </Box>
                )}
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  小模型
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                  }}
                >
                  可选
                </Box>
              </Stack>
              <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                在
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  内容发布{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能问答{' '}
                </Box>
                过程中使用。
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
              {modelData.analysis ? (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  状态正常
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  可选配置
                </Box>
              )}
            </Box>
            <Button
              size='small'
              variant='outlined'
              loading={openingAdd === 'analysis'}
              onClick={() => handleOpenAdd('analysis')}
            >
              {modelData.analysis ? '修改' : '配置'}
            </Button>
          </Stack>
        </Card>

        {/* Analysis-VL */}
        <Card
          sx={{
            flex: 1,
            p: 2,
            overflow: 'hidden',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'space-between'}
          >
            <Box>
              <Stack
                direction={'row'}
                alignItems={'center'}
                gap={1}
                sx={{ width: 500 }}
              >
                {modelData['analysis-vl'] ? (
                  <>
                    {IconAnalysisVLModel && (
                      <IconAnalysisVLModel sx={{ fontSize: 18 }} />
                    )}
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: 'text.tertiary',
                      }}
                    >
                      {ModelProvider[
                        modelData['analysis-vl']
                          .provider as keyof typeof ModelProvider
                      ].cn ||
                        ModelProvider[
                          modelData['analysis-vl']
                            .provider as keyof typeof ModelProvider
                        ].label ||
                        '其他'}
                      &nbsp;&nbsp;/
                    </Box>
                    <Box
                      sx={{
                        fontSize: 14,
                        lineHeight: '20px',
                        fontFamily: 'Gbold',
                        ml: -0.5,
                      }}
                    >
                      {modelData['analysis-vl'].model}
                    </Box>
                    <Box
                      sx={{
                        fontSize: 12,
                        px: 1,
                        lineHeight: '20px',
                        borderRadius: '10px',
                        bgcolor: addOpacityToColor(
                          theme.palette.primary.main,
                          0.1,
                        ),
                        color: 'primary.main',
                      }}
                    >
                      图像分析模型
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      fontSize: 14,
                      lineHeight: '20px',
                      fontFamily: 'Gbold',
                      ml: -0.5,
                    }}
                  >
                    图像分析模型
                  </Box>
                )}
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                >
                  视觉模型
                </Box>
                <Box
                  sx={{
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                  }}
                >
                  可选
                </Box>
                {modelData['analysis-vl'] && modelData['analysis-vl'].id && (
                  <Switch
                    size='small'
                    checked={modelData['analysis-vl'].is_active}
                    onChange={() => {
                      putApiV1Model({
                        ...modelData['analysis-vl'],
                        is_active: !modelData['analysis-vl'].is_active,
                      }).then(() => {
                        message.success('修改成功');
                        getModelList();
                      });
                    }}
                  />
                )}
              </Stack>
              <Box sx={{ fontSize: 12, color: 'text.tertiary', mt: 1 }}>
                在
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  内容发布{' '}
                </Box>
                和
                <Box component='span' sx={{ fontWeight: 'bold' }}>
                  {' '}
                  智能问答{' '}
                </Box>
                过程中使用，启用后图像分析能力可用，可选配置。
              </Box>
            </Box>
            <Box sx={{ flexGrow: 1, flexSelf: 'flex-start' }}>
              {modelData['analysis-vl'] ? (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: addOpacityToColor(theme.palette.success.main, 0.1),
                    color: 'success.main',
                  }}
                >
                  状态正常
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'inline-block',
                    fontSize: 12,
                    px: 1,
                    lineHeight: '20px',
                    borderRadius: '10px',
                    bgcolor: theme.palette.divider,
                    color: 'text.tertiary',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  可选模型
                </Box>
              )}
            </Box>
            <Button
              size='small'
              variant='outlined'
              loading={openingAdd === 'analysis-vl'}
              onClick={() => handleOpenAdd('analysis-vl')}
            >
              {modelData['analysis-vl'] ? '修改' : '配置'}
            </Button>
          </Stack>
        </Card>

        {addOpen && (
          <Suspense fallback={null}>
            <ModelModal
              open={addOpen}
              model_type={addType}
              data={
                addType === 'chat'
                  ? modelModalChatData
                  : addType === 'embedding'
                    ? modelModalEmbeddingData
                    : addType === 'rerank'
                      ? modelModalRerankData
                      : addType === 'analysis'
                        ? modelModalAnalysisData
                        : addType === 'analysis-vl'
                          ? modelModalAnalysisVLData
                          : null
              }
              onClose={() => {
                setAddOpen(false);
              }}
              refresh={async () => {
                setAddOpen(false);
                await getModelList();
              }}
              modelService={modelService}
              language='zh-CN'
              messageComponent={message}
              is_close_model_remark={true}
              addingModelTutorialURL='https://pandawiki.docs.baizhi.cloud/node/019a160d-0528-736a-b88e-32a2d1207f3e'
            />
          </Suspense>
        )}
      </Stack>
    );
  },
);

export default ModelConfig;
