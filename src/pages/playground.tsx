import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  useEditor,
  EditorContent,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import produce from "immer";
import cuid from "cuid";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

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
  id: string;
  value: JSONContent | string;
  onChange?: (value: JSONContent) => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onEditorSetup?: (editor: Editor) => void;
  onEditorCleanup?: () => void;
  onSplit?: () => void;
  onMerge?: (direction: "before" | "after") => void;
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

  const sortable = useSortable({ id: props.id });

  const onChange = useStableFn(props.onChange);
  const onAdd = useStableFn(props.onAdd);
  const onSplit = useStableFn(props.onSplit);
  const onDelete = useStableFn(props.onDelete);
  const onMerge = useStableFn(props.onMerge);
  const onEditorSetup = useStableFn(props.onEditorSetup);
  const onEditorCleanup = useStableFn(props.onEditorCleanup);

  useEffect(() => {
    if (!editor) return;

    onEditorSetup(editor);
    const onKeydown = (event: KeyboardEvent) => {
      const stopEvent = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.stopPropagation();
      };
      // event.persist();

      if (event.key === "Enter" && !event.shiftKey) {
        stopEvent();

        if (event.ctrlKey || event.metaKey || event.altKey) {
          return;
        }

        onSplit();
      }

      if (event.key === "Backspace") {
        if (editor.isEmpty) {
          stopEvent();
          onDelete();
          return;
        }

        // TODO: if not empty, and at start of line, merge with prev
        if (editor.state.selection.$head.pos <= 1) {
          console.log("hi");
          onMerge("before");
          stopEvent();
          return;
        }
      }

      if (event.key === "Delete") {
        // TODO:at END of line, merge next into current
        if (
          event.target &&
          editor.state.selection.$head.pos >
            ((event.target as HTMLElement).textContent?.length ?? 0)
        ) {
          onMerge("after");
          stopEvent();
          return;
        }
      }
    };
    const dom = editor.view.dom;

    dom.addEventListener("keydown", onKeydown, { capture: true });

    editor.on("update", ({ editor }) => {
      onChange(editor.getJSON());
    });

    return () => {
      onEditorCleanup();
      dom.removeEventListener("keydown", onKeydown, { capture: true });
    };
  }, [
    editor,
    onChange,
    onSplit,
    onEditorSetup,
    onEditorCleanup,
    onDelete,
    onMerge,
  ]);

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      {...sortable.attributes}
      className="group relative"
    >
      <div className="absolute -left-1 top-0 flex -translate-x-full gap-1 opacity-100 group-hocus:opacity-100">
        <button
          onClick={() => onAdd()}
          className="rounded p-1 text-sm transition-colors hocus:bg-gray-200"
        >
          +
        </button>
        <button
          {...sortable.listeners}
          className="rounded p-1 text-sm transition-colors hocus:bg-gray-200"
        >
          e
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

type Block = {
  // TODO: discriminated union to handle diff types
  content: JSONContent;
};

type Doc = {
  // TODO: discriminated union to handle diff types
  // type: "mdx" | "blocks";
  title: string;
  blocks: {
    order: string[];
    data: Record<string, Block>;
  };
};

const defaultBlock = (): [string, Block] => {
  const blockId = cuid();
  return [
    blockId,
    {
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: `type here to get started (${blockId})` },
            ],
          },
        ],
      },
    },
  ];
};

const blockFromContent = (content: JSONContent[]): [string, Block] => {
  const blockId = cuid();
  return [
    blockId,
    {
      content: {
        type: "doc",
        content,
      },
    },
  ];
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
  const editors = useRef<Record<string, Editor>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [draggingId, setDraggingeId] = useState<string | null>(null);

  console.log(doc);

  const insertNewBlock = (idx: number) => {
    const [newBlockId, newBlock] = defaultBlock();
    setDoc(
      produce((draft) => {
        draft.blocks.data[newBlockId] = newBlock;
        draft.blocks.order.splice(idx, 0, newBlockId);
      })
    );
  };

  const focusBlock = (
    id: string,
    position: "front" | "back" | "none" = "none"
  ) => {
    setTimeout(() => {
      const editor = editors.current[id];
      if (!editor || editor.isFocused) return;
      console.log("focussing");
      const chain = editor?.chain().focus();

      if (position === "front") {
        chain.selectTextblockStart();
      } else if (position === "back") {
        chain.selectTextblockEnd();
      }

      chain.run();
    }, 10);
  };

  return (
    <div className="mx-auto max-w-screen-lg p-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => {
          if (!active) return;
          setDraggingeId(active.id as string);
        }}
        onDragEnd={({ active, over }) => {
          if (!over) return;

          const oldIndex = doc.blocks.order.indexOf(active.id as string);
          const newIndex = doc.blocks.order.indexOf(over.id as string);

          setDoc(
            produce((draft) => {
              draft.blocks.order.splice(
                newIndex,
                0,
                draft.blocks.order.splice(oldIndex, 1)[0]
              );
            })
          );
        }}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={doc.blocks.order}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 rounded-xl ring-2 ring-purple-900">
            {doc.blocks.order.map((id, blockIdx) => {
              const block = doc.blocks.data[id];
              if (!block) return null;
              return (
                <Block
                  key={id}
                  id={id}
                  value={block.content}
                  onChange={(value) => {
                    setDoc(
                      produce((draft) => {
                        draft.blocks.data[id].content = value;
                      })
                    );
                  }}
                  onAdd={() => {
                    insertNewBlock(blockIdx + 1);
                  }}
                  onSplit={() => {
                    const editor = editors.current[id];
                    editor.commands.enter();
                    const blockJson = editor.getJSON();
                    const newBlockContent =
                      blockJson.content?.splice(1, 1) || [];
                    editor.commands.setContent(blockJson);
                    setDoc(
                      produce((draft) => {
                        draft.blocks.data[id].content = blockJson;
                        const [newBlockId, newBlock] =
                          blockFromContent(newBlockContent);
                        draft.blocks.data[newBlockId] = newBlock;
                        draft.blocks.order.splice(blockIdx + 1, 0, newBlockId);
                        focusBlock(newBlockId);
                      })
                    );
                  }}
                  onDelete={() => {
                    setDoc(
                      produce((draft) => {
                        draft.blocks.order.splice(blockIdx, 1);
                        delete draft.blocks.data[id];
                      })
                    );
                    const blockIndexToFocus = blockIdx >= 1 ? blockIdx - 1 : 0;
                    const blockIdToFocus = doc.blocks.order[blockIndexToFocus];
                    if (blockIdToFocus) focusBlock(blockIdToFocus);
                  }}
                  onMerge={async (direction) => {
                    if (direction === "before") {
                      if (blockIdx <= 0) return;
                      const currEditor = editors.current[id];
                      const prevId = doc.blocks.order[blockIdx - 1];
                      const prevEditor = editors.current[prevId];

                      console.log(currEditor.getHTML(), currEditor.getText());

                      const text = currEditor.getText();

                      // probably a smarter way to do with with `joinUp`
                      prevEditor.chain().focus().selectTextblockEnd().run();
                      const selection = prevEditor.state.selection.$head.pos;
                      prevEditor
                        .chain()
                        .insertContent(text)
                        .setTextSelection(selection)
                        .run();

                      setDoc(
                        produce((draft) => {
                          draft.blocks.order.splice(blockIdx, 1);
                          delete draft.blocks.data[id];
                        })
                      );
                    } else {
                      if (blockIdx >= doc.blocks.order.length - 1) {
                        return;
                      }
                      const currEditor = editors.current[id];
                      const nextIdx = blockIdx + 1;
                      const nextId = doc.blocks.order[nextIdx];
                      const nextEditor = editors.current[nextId];

                      console.log(currEditor.getHTML(), currEditor.getText());

                      const text = currEditor.getText();

                      // probably a smarter way to do with with `joinUp`
                      currEditor.chain().focus().selectTextblockEnd().run();
                      const selection = currEditor.state.selection.$head.pos;
                      currEditor
                        .chain()
                        .insertContent(text)
                        .setTextSelection(selection)
                        .run();

                      setDoc(
                        produce((draft) => {
                          draft.blocks.order.splice(nextIdx, 1);
                          delete draft.blocks.data[nextId];
                        })
                      );
                    }
                  }}
                  onEditorSetup={(editor) => {
                    editors.current[id] = editor;
                  }}
                  onEditorCleanup={() => {
                    delete editors.current[id];
                  }}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Playground;
