import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Markdown } from 'tiptap-markdown'
import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { cn } from '@renderer/lib/utils'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Link as LinkIcon,
  FileCode,
  Type,
  Pilcrow,
  TextCursorInput
} from 'lucide-react'

// Extend Storage type for markdown
declare module '@tiptap/core' {
  interface Storage {
    markdown: {
      getMarkdown: () => string
    }
  }
}

interface NotionEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

interface SlashMenuItem {
  title: string
  description: string
  icon: React.ReactNode
  command: () => void
  keywords?: string[]
}

interface SlashMenuGroup {
  name: string
  items: SlashMenuItem[]
}

/**
 * Notion-like rich text editor built with TipTap.
 *
 * Design Philosophy: Notion's signature aesthetic
 * - Whisper-quiet UI that stays out of the way
 * - Precise typography with careful weight distribution
 * - Subtle shadows that create depth without drama
 * - Animations so smooth they feel inevitable
 */
export function NotionEditor({
  content,
  onChange,
  placeholder = 'Press "/" for commands...',
  className,
  autoFocus = false
}: NotionEditorProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 })
  const [slashQuery, setSlashQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Floating toolbar state
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })

  const slashMenuRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const isSettingContentRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'notion-code-block' } }
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty'
      }),
      TaskList.configure({ HTMLAttributes: { class: 'notion-task-list' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'notion-task-item' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'notion-link' } }),
      Underline,
      Markdown.configure({ html: true, transformPastedText: true, transformCopiedText: true })
    ],
    content: '',
    autofocus: autoFocus ? 'start' : false,
    editorProps: {
      attributes: { class: 'notion-editor-content' },
      handleKeyDown: (_view, event) => {
        if (slashMenuOpen) {
          const flatItems = filteredGroups.flatMap(g => g.items)
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedIndex((prev) => (prev + 1) % flatItems.length)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length)
            return true
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (flatItems[selectedIndex]) {
              executeSlashCommand(flatItems[selectedIndex])
            }
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            closeSlashMenu()
            return true
          }
        }
        return false
      }
    },
    onUpdate: ({ editor: ed }) => {
      const markdown = (ed.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()

      // Skip onChange during programmatic content setting to avoid false hasChanges
      if (isSettingContentRef.current) {
        isSettingContentRef.current = false
      } else {
        onChange(markdown)
      }

      const { from } = ed.state.selection
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 50), from, '\n')
      const slashMatch = textBefore.match(/\/([a-zA-Z0-9]*)$/)

      if (slashMatch) {
        setSlashQuery(slashMatch[1])
        setSelectedIndex(0)
        const coords = ed.view.coordsAtPos(from - slashMatch[0].length)
        const editorRect = editorRef.current?.getBoundingClientRect()
        if (editorRect) {
          setSlashMenuPosition({
            top: coords.bottom - editorRect.top + 6,
            left: Math.max(0, coords.left - editorRect.left - 8)
          })
        }
        setSlashMenuOpen(true)
      } else {
        setSlashMenuOpen(false)
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection
      if (empty || from === to) {
        setShowToolbar(false)
        return
      }
      const coords = ed.view.coordsAtPos(from)
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (editorRect) {
        setToolbarPosition({
          top: coords.top - editorRect.top - 50,
          left: Math.max(0, coords.left - editorRect.left)
        })
        setShowToolbar(true)
      }
    },
    onBlur: () => {
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setShowToolbar(false)
        }
      }, 150)
    }
  })

  useEffect(() => {
    if (editor && content) {
      const currentContent = (editor.storage as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
      if (currentContent !== content && !editor.isFocused) {
        isSettingContentRef.current = true
        editor.commands.setContent(content)
        // Move cursor to start to prevent scroll to bottom
        editor.commands.setTextSelection(0)
      }
    }
  }, [editor, content])

  // Grouped slash command items - Notion style
  const slashGroups: SlashMenuGroup[] = useMemo(() => [
    {
      name: 'Basic blocks',
      items: [
        {
          title: 'Text',
          description: 'Just start writing with plain text.',
          icon: <Type strokeWidth={1.5} />,
          command: () => editor?.chain().focus().setParagraph().run(),
          keywords: ['paragraph', 'plain']
        },
        {
          title: 'Heading 1',
          description: 'Big section heading.',
          icon: <Heading1 strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          keywords: ['h1', 'title', 'large']
        },
        {
          title: 'Heading 2',
          description: 'Medium section heading.',
          icon: <Heading2 strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          keywords: ['h2', 'subtitle']
        },
        {
          title: 'Heading 3',
          description: 'Small section heading.',
          icon: <Heading3 strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
          keywords: ['h3', 'small']
        }
      ]
    },
    {
      name: 'Lists',
      items: [
        {
          title: 'Bulleted list',
          description: 'Create a simple bulleted list.',
          icon: <List strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleBulletList().run(),
          keywords: ['ul', 'unordered', 'bullet']
        },
        {
          title: 'Numbered list',
          description: 'Create a list with numbering.',
          icon: <ListOrdered strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleOrderedList().run(),
          keywords: ['ol', 'ordered', '1']
        },
        {
          title: 'To-do list',
          description: 'Track tasks with a to-do list.',
          icon: <CheckSquare strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleTaskList().run(),
          keywords: ['todo', 'task', 'checkbox', 'check']
        }
      ]
    },
    {
      name: 'Advanced',
      items: [
        {
          title: 'Quote',
          description: 'Capture a quote.',
          icon: <Quote strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleBlockquote().run(),
          keywords: ['blockquote', 'cite']
        },
        {
          title: 'Code',
          description: 'Capture a code snippet.',
          icon: <FileCode strokeWidth={1.5} />,
          command: () => editor?.chain().focus().toggleCodeBlock().run(),
          keywords: ['codeblock', 'snippet', 'programming']
        },
        {
          title: 'Divider',
          description: 'Visually divide blocks.',
          icon: <Minus strokeWidth={1.5} />,
          command: () => editor?.chain().focus().setHorizontalRule().run(),
          keywords: ['hr', 'line', 'separator']
        }
      ]
    }
  ], [editor])

  // Filter groups and items based on query
  const filteredGroups = useMemo(() => {
    if (!slashQuery) return slashGroups

    const query = slashQuery.toLowerCase()
    return slashGroups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.title.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.keywords?.some(k => k.includes(query))
        )
      }))
      .filter(group => group.items.length > 0)
  }, [slashGroups, slashQuery])

  const closeSlashMenu = useCallback(() => {
    setSlashMenuOpen(false)
    setSlashQuery('')
    setSelectedIndex(0)
  }, [])

  const executeSlashCommand = useCallback((item: SlashMenuItem) => {
    if (!editor) return
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from, '\n')
    const slashMatch = textBefore.match(/\/([a-zA-Z0-9]*)$/)
    if (slashMatch) {
      editor.commands.deleteRange({ from: from - slashMatch[0].length, to: from })
    }
    item.command()
    closeSlashMenu()
  }, [editor, closeSlashMenu])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  // Calculate the flat index for keyboard navigation
  const getFlatIndex = (groupIndex: number, itemIndex: number): number => {
    let index = 0
    for (let i = 0; i < groupIndex; i++) {
      index += filteredGroups[i].items.length
    }
    return index + itemIndex
  }

  // Scroll selected item into view when navigating with keyboard
  useEffect(() => {
    if (!slashMenuOpen || !slashMenuRef.current) return
    const selectedItem = slashMenuRef.current.querySelector(`[data-index="${selectedIndex}"]`)
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex, slashMenuOpen])

  if (!editor) return null

  return (
    <div ref={editorRef} className={cn('notion-editor relative', className)}>
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="notion-floating-toolbar absolute z-50"
          style={{ top: Math.max(0, toolbarPosition.top), left: toolbarPosition.left }}
        >
          <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-[#252526] p-1 shadow-2xl">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold">
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic">
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline">
              <UnderlineIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough">
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Code">
              <Code className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="Link">
              <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} isActive={editor.isActive('paragraph') && !editor.isActive('heading')} title="Text">
              <Pilcrow className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="H1">
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="H2">
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>
      )}

      {/* Notion-style Slash Command Menu */}
      {slashMenuOpen && filteredGroups.length > 0 && (
        <div
          ref={slashMenuRef}
          className="slash-menu"
          style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
        >
          {/* Search hint */}
          <div className="slash-menu-header">
            <TextCursorInput className="h-3.5 w-3.5 text-[#9b9b9b]" />
            <span>{slashQuery ? `Filtering: ${slashQuery}` : 'Type to filter...'}</span>
          </div>

          {/* Grouped items */}
          <div className="slash-menu-content">
            {filteredGroups.map((group, groupIndex) => (
              <div key={group.name} className="slash-menu-group">
                <div className="slash-menu-group-label">{group.name}</div>
                {group.items.map((item, itemIndex) => {
                  const flatIndex = getFlatIndex(groupIndex, itemIndex)
                  const isSelected = flatIndex === selectedIndex
                  return (
                    <button
                      key={item.title}
                      data-index={flatIndex}
                      onClick={() => executeSlashCommand(item)}
                      className={cn('slash-menu-item', isSelected && 'selected')}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                    >
                      <div className={cn('slash-menu-icon', isSelected && 'selected')}>
                        {item.icon}
                      </div>
                      <div className="slash-menu-text">
                        <span className="slash-menu-title">{item.title}</span>
                        <span className="slash-menu-desc">{item.description}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="slash-menu-footer">
            <span><kbd>↑↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      )}

      {/* No results state */}
      {slashMenuOpen && filteredGroups.length === 0 && (
        <div
          ref={slashMenuRef}
          className="slash-menu"
          style={{ top: slashMenuPosition.top, left: slashMenuPosition.left }}
        >
          <div className="slash-menu-empty">
            <span>No results for "{slashQuery}"</span>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />

      <style>{`
        /* ═══════════════════════════════════════════════════════════════
           NOTION EDITOR - Core Styles
           A whisper-quiet editor that lets content breathe
           ═══════════════════════════════════════════════════════════════ */

        .notion-editor {
          font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .notion-editor-content {
          outline: none;
          min-height: 60vh;
        }

        .notion-editor-content > .tiptap {
          outline: none;
        }

        /* Placeholder */
        .notion-editor-content .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #6b6b6b;
          pointer-events: none;
          height: 0;
          font-weight: 400;
        }

        /* ═══════════════════════════════════════════════════════════════
           SLASH COMMAND MENU - The star of the show
           Inspired by Notion's elegant command palette
           ═══════════════════════════════════════════════════════════════ */

        .slash-menu {
          position: absolute;
          z-index: 50;
          width: 320px;
          background: #252526;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 4px 6px -1px rgba(0, 0, 0, 0.3),
            0 12px 24px -4px rgba(0, 0, 0, 0.4),
            0 0 40px -8px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          animation: slashMenuIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slashMenuIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .slash-menu-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 12px;
          color: #6b6b6b;
          background: rgba(255, 255, 255, 0.02);
        }

        .slash-menu-content {
          max-height: 340px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 6px;
        }

        .slash-menu-content::-webkit-scrollbar {
          width: 4px;
        }

        .slash-menu-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .slash-menu-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        .slash-menu-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .slash-menu-group {
          margin-bottom: 4px;
        }

        .slash-menu-group:last-child {
          margin-bottom: 0;
        }

        .slash-menu-group-label {
          padding: 8px 8px 6px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b6b6b;
        }

        .slash-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 8px;
          border: none;
          border-radius: 8px;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s ease;
        }

        .slash-menu-item:hover,
        .slash-menu-item.selected {
          background: rgba(255, 255, 255, 0.06);
        }

        .slash-menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 46px;
          height: 46px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #a0a0a0;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .slash-menu-icon svg {
          width: 22px;
          height: 22px;
        }

        .slash-menu-item.selected .slash-menu-icon,
        .slash-menu-item:hover .slash-menu-icon {
          background: rgba(56, 189, 248, 0.1);
          border-color: rgba(56, 189, 248, 0.2);
          color: #38bdf8;
        }

        .slash-menu-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .slash-menu-title {
          font-size: 14px;
          font-weight: 500;
          color: #e4e4e4;
          line-height: 1.3;
        }

        .slash-menu-desc {
          font-size: 12px;
          color: #7a7a7a;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .slash-menu-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 8px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          font-size: 11px;
          color: #5a5a5a;
        }

        .slash-menu-footer kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          margin-right: 4px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 4px;
          color: #8a8a8a;
        }

        .slash-menu-empty {
          padding: 24px;
          text-align: center;
          color: #6b6b6b;
          font-size: 13px;
        }

        /* ═══════════════════════════════════════════════════════════════
           TYPOGRAPHY - Careful weight distribution
           ═══════════════════════════════════════════════════════════════ */

        .notion-editor-content p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.85);
        }

        .notion-editor-content h1 {
          font-size: 1.875rem;
          font-weight: 600;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          line-height: 1.25;
          color: #fff;
          letter-spacing: -0.02em;
        }

        .notion-editor-content h1:first-child {
          margin-top: 0;
        }

        .notion-editor-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
          color: #fff;
          letter-spacing: -0.01em;
        }

        .notion-editor-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          line-height: 1.35;
          color: #fff;
        }

        /* Lists */
        .notion-editor-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .notion-editor-content ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .notion-editor-content li {
          line-height: 1.7;
          margin-bottom: 0.25rem;
          color: rgba(255, 255, 255, 0.85);
        }

        .notion-editor-content li p {
          margin-bottom: 0;
        }

        /* Task List */
        .notion-task-list {
          list-style: none;
          padding-left: 0;
        }

        .notion-task-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .notion-task-item > label {
          display: flex;
          align-items: center;
          margin-top: 0.35rem;
        }

        .notion-task-item > label > input[type="checkbox"] {
          appearance: none;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          background: transparent;
        }

        .notion-task-item > label > input[type="checkbox"]:hover {
          border-color: #38bdf8;
        }

        .notion-task-item > label > input[type="checkbox"]:checked {
          background: #38bdf8;
          border-color: #38bdf8;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='%23000'%3E%3Cpath d='M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z'/%3E%3C/svg%3E");
          background-size: 10px;
          background-position: center;
          background-repeat: no-repeat;
        }

        .notion-task-item[data-checked="true"] > div {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Blockquote */
        .notion-editor-content blockquote {
          border-left: 3px solid rgba(56, 189, 248, 0.4);
          padding-left: 1rem;
          margin: 1rem 0;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Code */
        .notion-editor-content code {
          background: rgba(255, 255, 255, 0.08);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-family: "SF Mono", SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace;
          font-size: 0.875em;
          color: #f472b6;
        }

        .notion-editor-content pre {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
          overflow-x: auto;
        }

        .notion-editor-content pre code {
          background: none;
          padding: 0;
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        /* Horizontal Rule */
        .notion-editor-content hr {
          border: none;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 2rem 0;
        }

        /* Links */
        .notion-link {
          color: #38bdf8;
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-color: rgba(56, 189, 248, 0.3);
          transition: text-decoration-color 0.15s;
        }

        .notion-link:hover {
          text-decoration-color: rgba(56, 189, 248, 0.6);
        }

        /* Strong and Emphasis */
        .notion-editor-content strong {
          font-weight: 600;
          color: #fff;
        }

        .notion-editor-content em {
          font-style: italic;
        }

        .notion-editor-content s {
          text-decoration: line-through;
          color: rgba(255, 255, 255, 0.4);
        }

        .notion-editor-content u {
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* Selection */
        .notion-editor-content ::selection {
          background: rgba(56, 189, 248, 0.25);
        }
      `}</style>
    </div>
  )
}

/**
 * Toolbar button component
 */
function ToolbarButton({
  onClick,
  isActive,
  title,
  children
}: {
  onClick: () => void
  isActive: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-all duration-100',
        isActive
          ? 'bg-sky-500/20 text-sky-400'
          : 'text-[#a0a0a0] hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {children}
    </button>
  )
}
