import {
  AiGenerate2Icon,
  EditorToolbar,
  UseTiptapReturn,
} from '@ctzhian/tiptap';
import ToolbarItem from '@ctzhian/tiptap/dist/component/Toolbar/Item';
import { Box } from '@mui/material';
import { IconNeirongguanli } from '@panda-wiki/icons';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToolbarProps {
  editorRef: UseTiptapReturn;
  handleAiGenerate?: () => void;
  handleDocReference?: () => void;
}

const DOC_REF_SLOT_CLASS = 'doc-reference-slot';

const Toolbar = ({
  editorRef,
  handleAiGenerate,
  handleDocReference,
}: ToolbarProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const positionSlot = () => {
      const stack = wrapper.querySelector<HTMLElement>(
        '.editor-toolbar > .MuiStack-root',
      );
      if (!stack) return;

      const realChildren = Array.from(stack.children).filter(
        c => !(c as HTMLElement).classList.contains(DOC_REF_SLOT_CLASS),
      ) as HTMLElement[];
      const insertIdx = realChildren.findIndex(el =>
        el.textContent?.includes('插入'),
      );
      if (insertIdx === -1) return;

      const nextSibling = realChildren[insertIdx + 1] ?? null;

      let slot = stack.querySelector<HTMLElement>(`.${DOC_REF_SLOT_CLASS}`);
      if (!slot) {
        slot = document.createElement('span');
        slot.className = DOC_REF_SLOT_CLASS;
        slot.style.display = 'inline-flex';
        slot.style.alignItems = 'center';
      }

      if (slot.parentElement !== stack || slot.nextSibling !== nextSibling) {
        stack.insertBefore(slot, nextSibling);
      }

      setSlotEl(prev => (prev === slot ? prev : slot));
    };

    positionSlot();

    const observer = new MutationObserver(positionSlot);
    observer.observe(wrapper, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      wrapper.querySelector(`.${DOC_REF_SLOT_CLASS}`)?.remove();
    };
  }, []);

  return (
    <Box
      ref={wrapperRef}
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
            id: 'ai',
            label: '文本润色',
            icon: <AiGenerate2Icon sx={{ fontSize: '1rem' }} />,
            onClick: handleAiGenerate,
          },
        ]}
      />
      {slotEl &&
        createPortal(
          <ToolbarItem
            tip='文档引用'
            icon={<IconNeirongguanli sx={{ fontSize: '1rem' }} />}
            onClick={handleDocReference}
          />,
          slotEl,
        )}
    </Box>
  );
};

export default Toolbar;
