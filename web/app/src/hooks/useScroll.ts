import { TocItem, TocList } from '@ctzhian/tiptap';
import { useCallback, useEffect, useRef, useState } from 'react';

const useScroll = (headings: TocList, domId: string, defaultOffset = 80) => {
  const [activeHeading, setActiveHeading] = useState<TocItem | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualScroll = useRef(false);
  // 记录已经"应用过 hash 滚动"的 key，避免同一文档内重复触发
  const lastAppliedKeyRef = useRef<string>('');

  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    delay: number,
  ) => {
    return (...args: Parameters<T>) => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => func(...args), delay);
    };
  };

  const scrollToElement = useCallback(
    (elementId: string, offset = defaultOffset) => {
      const element = document.getElementById(elementId);
      if (element) {
        const container = document.getElementById(domId) || window;
        const targetHeading = headings.find(h => h.id === elementId);
        if (targetHeading) {
          isManualScroll.current = true;
          setActiveHeading(targetHeading);
          location.hash = encodeURIComponent(targetHeading.textContent);

          const elementPosition = element.getBoundingClientRect().top;
          const scrollTop =
            'scrollY' in container ? container.scrollY : container.scrollTop;
          const offsetPosition = elementPosition + scrollTop - offset;

          container.scrollTo({
            top: offsetPosition,
            behavior: 'smooth',
          });

          setTimeout(() => {
            isManualScroll.current = false;
          }, 1000);
        }
      }
    },
    [headings, defaultOffset, domId],
  );

  const findActiveHeading = useCallback(() => {
    const levels = Array.from(
      new Set(headings.map(it => it.level).sort((a, b) => a - b)),
    ).slice(0, 3);
    const visibleHeadings = headings.filter(header =>
      levels.includes(header.level),
    );

    if (visibleHeadings.length === 0) return null;

    const offset = 100;
    let activeHeader: TocItem | null = null;

    for (let i = visibleHeadings.length - 1; i >= 0; i--) {
      const header = visibleHeadings[i];
      const element = document.getElementById(header.id);
      if (element) {
        const container = document.getElementById(domId) || window;
        const scrollTop =
          'scrollY' in container ? container.scrollY : container.scrollTop;
        const elementTop = element.getBoundingClientRect().top + scrollTop;
        if (elementTop <= scrollTop + offset) {
          activeHeader = header;
          break;
        }
      }
    }

    if (!activeHeader && visibleHeadings.length > 0) {
      activeHeader = visibleHeadings[0];
    }

    return activeHeader;
  }, [headings]);

  const debouncedScrollHandler = useCallback(
    debounce(() => {
      if (isManualScroll.current) return;
      const activeHeader = findActiveHeading();
      if (activeHeader && activeHeader.id !== activeHeading?.id) {
        setActiveHeading(activeHeader);
      }
    }, 100),
    [findActiveHeading, activeHeading],
  );

  // 读取 location.hash 并尝试滚动到匹配的 heading；可重复调用。
  const applyHashScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!headings || headings.length === 0) return;
    const rawHash = location.hash;
    if (!rawHash) return;
    let hash = '';
    try {
      hash = decodeURIComponent(rawHash.slice(1));
    } catch {
      hash = rawHash.slice(1);
    }
    if (!hash) return;
    // 避免同一文档同一 hash 重复触发
    const key = `${location.pathname}|${rawHash}|${headings.length}`;
    if (lastAppliedKeyRef.current === key) return;

    const targetHeading = headings.find(header => header.textContent === hash);
    if (!targetHeading) return;

    lastAppliedKeyRef.current = key;
    setActiveHeading(targetHeading);
    setTimeout(() => {
      isManualScroll.current = true;
      const element = document.getElementById(targetHeading.id);
      if (element) {
        const container = document.getElementById(domId) || window;
        const elementPosition = element.getBoundingClientRect().top;
        const scrollTop =
          'scrollY' in container ? container.scrollY : container.scrollTop;
        const offsetPosition = elementPosition + scrollTop - defaultOffset;
        container.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
      setTimeout(() => {
        isManualScroll.current = false;
      }, 1000);
    }, 100);
  }, [headings, defaultOffset, domId]);

  // headings 重建时（首次加载 / SPA 文档切换）尝试应用 hash
  useEffect(() => {
    applyHashScroll();
  }, [applyHashScroll]);

  // 监听 hash 手动变化（点击 DocAnchor / 同页改 hash 等）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      // hash 变化时认为是新的滚动意图，清掉 key 让 applyHashScroll 可再次触发
      lastAppliedKeyRef.current = '';
      applyHashScroll();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [applyHashScroll]);

  useEffect(() => {
    if (headings.length === 0) return;
    const container = document.getElementById(domId) || window;
    container.addEventListener('scroll', debouncedScrollHandler);
    debouncedScrollHandler();
    return () => {
      container.removeEventListener('scroll', debouncedScrollHandler);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [debouncedScrollHandler, headings, domId]);

  return {
    activeHeading,
    scrollToElement,
  };
};

export default useScroll;
