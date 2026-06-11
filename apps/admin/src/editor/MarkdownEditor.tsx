import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import { Markdown } from "tiptap-markdown";

/**
 * 双模编辑器（docs/06-site-admin.md §3.2）：
 * Markdown 字符串是唯一真源；富文本视图只是它的投影，切换/保存都先序列化回 markdown。
 */
interface Props {
  value: string;
  onChange: (md: string) => void;
  onUploadImage?: (file: File) => Promise<string>; // 返回 markdown 引用
}

export function MarkdownEditor({ value, onChange, onUploadImage }: Props) {
  const [mode, setMode] = useState<"rich" | "source">("rich");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({ html: false, linkify: true, breaks: false }),
    ],
    content: value,
    onUpdate({ editor }) {
      onChange((editor.storage as MarkdownStorage).markdown.getMarkdown());
    },
  });

  // 外部载入新文章时同步（仅当内容真变了，避免光标跳动）
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as MarkdownStorage).markdown.getMarkdown();
    if (current !== value && !editor.isFocused) editor.commands.setContent(value);
  }, [value, editor]);

  function switchMode(next: "rich" | "source") {
    if (next === "rich" && editor) editor.commands.setContent(value);
    setMode(next);
  }

  async function uploadAndInsert(file: File) {
    if (!onUploadImage) return;
    const md = await onUploadImage(file);
    if (mode === "source") {
      onChange(`${value}\n\n${md}\n`);
    } else if (editor) {
      const src = md.match(/\((.+)\)/)?.[1] ?? "";
      editor.chain().focus().setImage({ src }).run();
      onChange((editor.storage as MarkdownStorage).markdown.getMarkdown());
    }
  }

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        {mode === "rich" && editor && <RichToolbar editor={editor} />}
        <span className="spacer" />
        {onUploadImage && (
          <label className="clay-btn tool-btn" data-variant="soft">
            🖼 插图
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAndInsert(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        <button
          type="button"
          className="clay-btn tool-btn"
          data-variant={mode === "source" ? "primary" : "soft"}
          onClick={() => switchMode(mode === "rich" ? "source" : "rich")}
        >
          {mode === "rich" ? "MD 源码" : "富文本"}
        </button>
      </div>

      {mode === "rich" ? (
        <EditorContent editor={editor} className="rich-area" />
      ) : (
        <textarea
          className="clay-textarea source-area"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          onPaste={(e) => {
            const file = e.clipboardData.files?.[0];
            if (file?.type.startsWith("image/")) {
              e.preventDefault();
              void uploadAndInsert(file);
            }
          }}
        />
      )}
    </div>
  );
}

interface MarkdownStorage {
  markdown: { getMarkdown(): string };
}

function RichToolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, active: boolean, run: () => void, title: string) => (
    <button
      type="button"
      className="clay-btn tool-btn"
      data-variant={active ? "primary" : "ghost"}
      onMouseDown={(e) => {
        e.preventDefault();
        run();
      }}
      title={title}
    >
      {label}
    </button>
  );
  const c = editor.chain().focus();
  return (
    <>
      {btn("B", editor.isActive("bold"), () => c.toggleBold().run(), "加粗")}
      {btn("I", editor.isActive("italic"), () => c.toggleItalic().run(), "斜体")}
      {btn("H2", editor.isActive("heading", { level: 2 }), () => c.toggleHeading({ level: 2 }).run(), "二级标题")}
      {btn("H3", editor.isActive("heading", { level: 3 }), () => c.toggleHeading({ level: 3 }).run(), "三级标题")}
      {btn("•", editor.isActive("bulletList"), () => c.toggleBulletList().run(), "无序列表")}
      {btn("1.", editor.isActive("orderedList"), () => c.toggleOrderedList().run(), "有序列表")}
      {btn("❝", editor.isActive("blockquote"), () => c.toggleBlockquote().run(), "引用")}
      {btn("</>", editor.isActive("codeBlock"), () => c.toggleCodeBlock().run(), "代码块")}
      {btn("🔗", editor.isActive("link"), () => {
        const url = prompt("链接地址：");
        if (url) c.setLink({ href: url }).run();
        else c.unsetLink().run();
      }, "链接")}
    </>
  );
}
