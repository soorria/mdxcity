import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import produce from "immer";
import cuid from "cuid";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStableFn = <T extends (...args: any[]) => any>(
  fn: T | undefined | null
): T => {
  const ref = useRef(fn);
  useIsomorphicLayoutEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback(
    (...args: Parameters<T>) => ref.current?.(...args),
    []
  ) as T;
};

const Block: React.FC<{
  value: JSONContent | string;
  onChange?: (value: JSONContent) => void;
  onAdd?: () => void;
}> = (props) => {
  const editor = useEditor({
    extensions: [
      // consider adding:
      // - https://tiptap.dev/api/extensions/bubble-menu

      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        showOnlyWhenEditable: true,
        placeholder: "type here",
        includeChildren: true,
      }),
    ],
    content: props.value,
  });

  const onChange = useStableFn(props.onChange);

  useEffect(() => {
    if (!editor) return;

    editor.view.dom.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          event.stopPropagation();
        }
      },
      { capture: true }
    );

    editor.on("update", ({ editor }) => {
      onChange(editor.getJSON());
    });
  }, [editor, onChange]);

  return (
    <div className="group relative">
      <div className="absolute -left-1 top-0 flex -translate-x-full gap-1 opacity-100 group-hocus:opacity-100">
        <button
          onClick={() => props.onAdd?.()}
          className="rounded p-1 text-sm transition-colors hocus:bg-gray-200"
        >
          +
        </button>
        {/* <button className="rounded p-1 text-sm transition-colors hocus:bg-gray-200">
          e
        </button> */}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

type Doc = {
  // TODO: discriminated union to handle diff types
  // type: "mdx" | "blocks";
  title: string;
  blocks: {
    order: string[];
    data: Record<
      string,
      {
        // TODO: discriminated union to handle diff types
        content: JSONContent | string;
      }
    >;
  };
};

const defaultBlock = () => {
  const blockId = cuid();
  return [
    blockId,
    {
      content: `<p>Type here to get started! (id: ${blockId})</p>`,
    },
  ] as const;
};

const initialDoc: Doc = (() => {
  const [blockId, block] = defaultBlock();

  return {
    title: "testing",
    blocks: {
      order: [blockId],
      data: {
        [blockId]: block,
      },
    },
  };
})();

const Playground: React.FC = () => {
  const [doc, setDoc] = useState<Doc>(initialDoc);

  return (
    <div className="mx-auto max-w-screen-lg p-8">
      <div className="space-y-2 rounded-xl ring-2 ring-purple-900">
        {doc.blocks.order.map((id, blockIdx) => {
          const block = doc.blocks.data[id];
          if (!block) return null;
          return (
            <Block
              key={id}
              value={block.content}
              onChange={(value) => {
                setDoc(
                  produce((draft) => {
                    draft.blocks.data[id].content = value;
                  })
                );
              }}
              onAdd={() => {
                const [newBlockId, newBlock] = defaultBlock();
                setDoc(
                  produce((draft) => {
                    draft.blocks.data[newBlockId] = newBlock;
                    draft.blocks.order.splice(blockIdx + 1, 0, newBlockId);
                  })
                );
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default Playground;
