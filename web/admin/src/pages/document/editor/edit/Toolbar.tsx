import {
  AiGenerate2Icon,
  EditorToolbar,
  UseTiptapReturn,
} from '@ctzhian/tiptap';
import { Box } from '@mui/material';
import { IconNeirongguanli } from '@panda-wiki/icons';

interface ToolbarProps {
  editorRef: UseTiptapReturn;
  handleAiGenerate?: () => void;
  handleDocReference?: () => void;
}

const Toolbar = ({
  editorRef,
  handleAiGenerate,
  handleDocReference,
}: ToolbarProps) => {
  return (
    <Box
      sx={{
        width: 'auto',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '10px',
        bgcolor: 'background.default',
        px: 0.5,
        mx: 1,
      }}
    >
      <EditorToolbar
        editor={editorRef.editor}
        menuInToolbarMore={[
          {
            id: 'doc-reference',
            label: '文档引用',
            icon: <IconNeirongguanli sx={{ fontSize: '1rem' }} />,
            onClick: handleDocReference,
          },
          {
            id: 'ai',
            label: '文本润色',
            icon: <AiGenerate2Icon sx={{ fontSize: '1rem' }} />,
            onClick: handleAiGenerate,
          },
        ]}
      />
    </Box>
  );
};

export default Toolbar;
