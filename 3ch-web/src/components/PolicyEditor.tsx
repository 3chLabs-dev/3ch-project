import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";
import {
  Box, Divider, IconButton, Stack, Tooltip, Button,
} from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import TableChartIcon from "@mui/icons-material/TableChart";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import InsertPhotoIcon from "@mui/icons-material/InsertPhoto";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";

interface Props {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}

/** plain text → HTML 변환. 모든 \n을 <br>로 처리해 일관된 줄바꿈 */
function toHTML(s: string): string {
  if (!s) return "";
  if (s.trimStart().startsWith("<")) return s;
  return `<p>${s.trim().replace(/\n/g, "<br>")}</p>`;
}

const activeSx = (active: boolean) => ({
  borderRadius: 1,
  p: 0.5,
  bgcolor: active ? "primary.main" : "transparent",
  color: active ? "white" : "text.primary",
  "&:hover": { bgcolor: active ? "primary.dark" : "action.hover" },
});

export default function PolicyEditor({ value, onChange, minHeight = 360 }: Props) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Image.configure({
        allowBase64: true,
        inline: true,
        HTMLAttributes: { style: "max-width: 100%; height: auto;" },
      }),
    ],
    content: toHTML(value),
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    // 에디터가 이미 해당 내용을 갖고 있으면 setContent 생략 (커서 리셋 방지)
    if (value === editor.getHTML()) return;
    editor.commands.setContent(toHTML(value), { emitUpdate: false });
  }, [value, editor]);

  const isInTable = editor?.isActive("table") ?? false;

  const handleSetLink = () => {
    const prev = editor?.getAttributes("link").href ?? "";
    const url = window.prompt("링크 URL을 입력하세요", prev);
    if (url === null) return; // 취소
    if (url === "") {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleInsertImage = () => {
    const url = window.prompt("이미지 URL을 입력하세요");
    if (!url) return;
    editor?.chain().focus().setImage({ src: url }).run();
  };

  const imageUploadRef = useRef<HTMLInputElement>(null);
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      if (src) editor?.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // 같은 파일 재선택 가능하도록 초기화
  };

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      {/* 툴바: onMouseDown preventDefault → 버튼 클릭 시 에디터 selection 유지 */}
      <Box
        onMouseDown={(e) => e.preventDefault()}
        sx={{
          px: 1,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "#FAFAFA",
          display: "flex",
          flexWrap: "wrap",
          gap: 0.5,
          alignItems: "center",
        }}
      >
        {/* 굵게 / 기울임 */}
        <Tooltip title="굵게 (Ctrl+B)">
          <IconButton size="small" onClick={() => editor?.chain().focus().toggleBold().run()} sx={activeSx(editor?.isActive("bold") ?? false)}>
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="기울임 (Ctrl+I)">
          <IconButton size="small" onClick={() => editor?.chain().focus().toggleItalic().run()} sx={activeSx(editor?.isActive("italic") ?? false)}>
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 글자색 */}
        <Tooltip title="글자색">
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <IconButton size="small" onClick={() => colorInputRef.current?.click()} sx={activeSx(false)}>
              <FormatColorTextIcon fontSize="small" />
            </IconButton>
            <input
              ref={colorInputRef}
              type="color"
              defaultValue="#000000"
              style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
              onInput={(e) => editor?.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            />
          </Box>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        {/* 제목 */}
        {([1, 2, 3] as const).map((level) => (
          <Tooltip key={level} title={`제목 ${level}`}>
            <IconButton
              size="small"
              onClick={() => editor?.chain().focus().toggleHeading({ level }).run()}
              sx={{ ...activeSx(editor?.isActive("heading", { level }) ?? false), fontSize: 12, fontWeight: 700, width: 28, height: 28 }}
            >
              {`H${level}`}
            </IconButton>
          </Tooltip>
        ))}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        {/* 목록 */}
        <Tooltip title="글머리 기호">
          <IconButton size="small" onClick={() => editor?.chain().focus().toggleBulletList().run()} sx={activeSx(editor?.isActive("bulletList") ?? false)}>
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="번호 목록">
          <IconButton size="small" onClick={() => editor?.chain().focus().toggleOrderedList().run()} sx={activeSx(editor?.isActive("orderedList") ?? false)}>
            <FormatListNumberedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        {/* 링크 */}
        <Tooltip title="링크 삽입/수정">
          <IconButton size="small" onClick={handleSetLink} sx={activeSx(editor?.isActive("link") ?? false)}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="링크 제거">
          <IconButton size="small" onClick={() => editor?.chain().focus().unsetLink().run()} sx={activeSx(false)} disabled={!(editor?.isActive("link") ?? false)}>
            <LinkOffIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 이미지 - URL */}
        <Tooltip title="이미지 URL로 삽입">
          <IconButton size="small" onClick={handleInsertImage} sx={activeSx(false)}>
            <InsertPhotoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {/* 이미지 - 파일 업로드 */}
        <Tooltip title="이미지 파일 업로드">
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <IconButton size="small" onClick={() => imageUploadRef.current?.click()} sx={activeSx(false)}>
              <FileUploadIcon fontSize="small" />
            </IconButton>
            <input
              ref={imageUploadRef}
              type="file"
              accept="image/*"
              style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
              onChange={handleImageFile}
            />
          </Box>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

        {/* 표 삽입 */}
        <Tooltip title="표 삽입 (3×3)">
          <IconButton size="small" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} sx={activeSx(false)}>
            <TableChartIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* 표 편집 (커서가 표 안에 있을 때만) */}
        {isInTable && (
          <Stack direction="row" gap={0.5} alignItems="center">
            <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
            {[
              { label: "행↓", tip: "아래 행 추가",   fn: () => editor?.chain().focus().addRowAfter().run() },
              { label: "행 삭제", tip: "행 삭제",        fn: () => editor?.chain().focus().deleteRow().run() },
              { label: "열→", tip: "오른쪽 열 추가", fn: () => editor?.chain().focus().addColumnAfter().run() },
              { label: "열 삭제", tip: "열 삭제",        fn: () => editor?.chain().focus().deleteColumn().run() },
            ].map(({ label, tip, fn }) => (
              <Tooltip key={label} title={tip}>
                <Button size="small" variant="outlined" onClick={fn}
                  sx={{ fontSize: 11, py: 0, px: 0.75, minWidth: 0, height: 26, lineHeight: 1 }}>
                  {label}
                </Button>
              </Tooltip>
            ))}
            <Tooltip title="표 전체 삭제">
              <Button size="small" variant="outlined" color="error"
                onClick={() => editor?.chain().focus().deleteTable().run()}
                sx={{ fontSize: 11, py: 0, px: 0.75, minWidth: 0, height: 26, lineHeight: 1 }}>
                표 삭제
              </Button>
            </Tooltip>
          </Stack>
        )}
      </Box>

      {/* 에디터 본문 */}
      <Box
        sx={{
          "& .ProseMirror": {
            outline: "none",
            minHeight,
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.8,
            fontFamily: "inherit",
            "& h1": { fontSize: 17, fontWeight: 700, margin: "12px 0 4px" },
            "& h2": { fontSize: 15, fontWeight: 700, margin: "10px 0 4px" },
            "& h3": { fontSize: 13, fontWeight: 700, margin: "8px 0 4px" },
            "& p": { margin: 0 },
            "& p:empty": { minHeight: "1.6em" },
            "& ul, & ol": { paddingLeft: 24, margin: "4px 0" },
            "& li + li": { marginTop: 2 },
            "& a": { color: "#2563EB", textDecoration: "underline" },
            "& img": { maxWidth: "100%", height: "auto", borderRadius: 4 },
            "& table": { borderCollapse: "collapse", width: "100%", margin: "8px 0" },
            "& td, & th": { border: "1px solid #D1D5DB", padding: "6px 10px", textAlign: "left", verticalAlign: "top" },
            "& th": { backgroundColor: "#F3F4F6", fontWeight: 700 },
            "& .selectedCell": { backgroundColor: "#DBEAFE" },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
