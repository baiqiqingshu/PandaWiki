import { ConstsHomePageSetting } from '@/request/types';
import { getBasePath } from '@/utils/getBasePath';

export const INIT_DOC_DATA = [
  {
    type: 2,
    emoji: '🔥',
    name: '快速上手 - 新手必读 ！！！',
    summary:
      '本文档介绍知识库的基础使用流程，包括登录控制台、创建文档、配置 AI 模型、发布内容以及访问 Wiki 网站。',
    content:
      '<h1 id="quick-start">快速上手</h1><p>欢迎使用知识库。你可以在控制台中创建、编辑和发布文档，并在 Wiki 网站中向成员或访客展示内容。</p><h2 id="login">登录控制台</h2><p>使用管理员账号进入控制台后，可以在左侧菜单中管理文档、查看统计、调整站点设置并发布内容。</p><p><img src="/images/init/doc_login.png" width="683" height="387"></p><h2 id="model">配置 AI 模型</h2><p>如果需要使用 AI 创作、AI 问答和 AI 搜索，请先在系统设置中配置可用的大模型、向量模型和重排序模型。</p><p><img src="/images/init/doc_model.png" width="694" height="393"></p><h2 id="create-wiki">创建知识库</h2><p>知识库是一组文档的集合。创建知识库后，你可以导入已有资料，也可以直接新建文档。</p><p><img src="/images/init/doc_create_wiki.png" width="696" height="394"></p><h2 id="publish">发布内容</h2><p>文档编辑完成后，执行发布操作即可让 Wiki 网站展示最新内容。</p>',
  },
  {
    type: 2,
    emoji: '🧭',
    name: '内容组织建议',
    summary:
      '介绍如何组织知识库目录、首页推荐内容和常见问题，帮助读者更快找到所需信息。',
    content:
      '<h1 id="content-structure">内容组织建议</h1><p>清晰的目录和稳定的命名方式可以降低维护成本，也能帮助读者快速定位答案。</p><h2 id="nav">目录规划</h2><ul class="bullet-list" data-type="bulletList"><li><p>按产品、场景或团队划分一级目录。</p></li><li><p>把高频问题放在靠前位置。</p></li><li><p>避免同一主题分散在多个目录下。</p></li></ul><h2 id="home">首页内容</h2><p>首页适合放置入门指南、核心功能、推荐文档和常见问题。你可以在站点装修中调整这些模块。</p>',
  },
  {
    type: 2,
    emoji: '📡',
    name: '接入 AI 模型',

    summary:
      '介绍 AI 问答和搜索需要的模型类型，以及接入 OpenAI 兼容接口时需要准备的基础信息。',
    content:
      '<h1 id="ai-model">接入 AI 模型</h1><p>AI 问答和智能搜索通常需要三类模型：对话模型、向量模型和重排序模型。你可以根据自己的部署环境选择本地模型或兼容 OpenAI 接口的模型服务。</p><h2 id="model-types">模型类型</h2><ul class="bullet-list" data-type="bulletList"><li><p><strong>对话模型</strong>：用于回答问题、生成摘要和辅助写作。</p></li><li><p><strong>向量模型</strong>：用于把文档内容转换为可检索的向量。</p></li><li><p><strong>重排序模型</strong>：用于对召回结果做二次排序，提升答案相关性。</p></li></ul><h2 id="config">配置项</h2><p>接入模型时通常需要填写模型名称、API 地址和 API Key。配置完成后，建议先执行连通性测试，再发布文档并验证问答效果。</p>',
  },
] as const;

export const INIT_LADING_DATA = {
  title: 'PandaWiki',
  theme_mode: 'light',
  home_page_setting:
    ConstsHomePageSetting.HomePageSettingCustom as ConstsHomePageSetting,
  icon: getBasePath('/images/init/icon.png'),
  btns: [],
  web_app_custom_style: {
    allow_theme_switching: false,
    header_search_placeholder: '问问AI吧',
    show_brand_info: false,
    footer_show_intro: true,
    social_media_accounts: [],
  },
  footer_settings: {
    footer_style: 'complex',
    corp_name: '',
    icp: '',
    brand_name: 'PandaWiki 知识库',
    brand_desc:
      'PandaWiki 是一款 AI 驱动的开源知识库系统，支持构建产品文档、技术文档、FAQ 和博客，提供AI创作、问答和搜索功能',
    brand_logo: getBasePath('/images/init/brand_logo.png'),
    brand_groups: [],
  },
  web_app_landing_configs: [
    {
      type: 'banner',
      banner_config: {
        title: '欢迎使用 PandaWiki AI 知识库',
        title_color: '#6E73FE',
        title_font_size: 60,
        subtitle:
          'PandaWiki 是一款 AI 驱动的开源知识库搭建系统，帮助你快速构建智能化产品文档、技术文档、FAQ、博客系统，借助大模型的力量为你提供 AI 创作、AI 问答、AI 搜索等能力。',
        placeholder: '有问题？问问 AI',
        subtitle_color: '#ffffff80',
        subtitle_font_size: 16,
        bg_url: '',
        hot_search: [
          '如何安装PandaWiki',
          'PandaWiki能做什么？',
          '忘了admin的密码如何重置？',
        ],
        btns: [
          {
            id: '1760701149843',
            text: '查看文档',
            type: 'contained',
            href: '',
          },
        ],
      },

      node_ids: [],
      nodes: null,
    },
    {
      type: 'basic_doc',
      basic_doc_config: {
        title: '极速入门',
        title_color: '#000000',
        bg_color: '#ffffff00',
      },
      node_ids: [],
    },
    {
      type: 'carousel',
      carousel_config: {
        title: '产品介绍',
        bg_color: '#3248F2',
        list: [
          {
            id: '1760701308042',
            title: '数据统计',
            url: getBasePath('/images/init/carousel_data_statistics.jpg'),
            desc: '',
          },
          {
            id: '1760701285851',
            title: '文档管理',
            url: getBasePath('/images/init/carousel_doc_manage.jpg'),
            desc: '',
          },
          {
            id: '1760701343411',
            title: '文档首页',
            url: getBasePath('/images/init/carousel_doc_home.jpg'),
            desc: '',
          },
          {
            id: '1760701321421',
            title: '智能问答',
            url: getBasePath('/images/init/carousel_ai_qa.jpg'),
            desc: '',
          },
          {
            id: '1760701346392',
            title: '三方机器人集成',
            url: getBasePath('/images/init/carousel_third_party_robot.jpg'),
            desc: '',
          },
          {
            id: '1760701385679',
            title: '网页挂件机器人',
            url: getBasePath('/images/init/carousel_web_robot.jpg'),
            desc: '',
          },
        ],
      },
      node_ids: [],
      nodes: null,
    },
    {
      type: 'faq',
      faq_config: {
        title: '常见问题',
        title_color: '#000000',
        bg_color: '#ffffff00',
        list: [
          {
            id: '1760701530938',
            question: '如何创建第一篇文档？',
            link: '',
          },
          {
            id: '1760701557320',
            question: '如何发布 Wiki 网站？',
            link: '',
          },
        ],
      },
      node_ids: [],
      nodes: null,
    },
  ],
};
