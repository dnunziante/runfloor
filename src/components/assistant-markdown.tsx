import { Fragment, type ReactNode } from "react";

function inline(value: string) {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
}

function tableCells(line: string) { return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()); }
function isTableDivider(line: string) { return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line); }

export function AssistantMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n"); const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) { const headers = tableCells(line); index += 2; const rows: string[][] = []; while (index < lines.length && lines[index].includes("|")) { rows.push(tableCells(lines[index])); index += 1; } blocks.push(<div className="assistant-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}>{inline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || "")}</td>)}</tr>)}</tbody></table></div>); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line); if (heading) { const Tag = `h${Math.min(heading[1].length + 2, 4)}` as "h3" | "h4"; blocks.push(<Tag key={`heading-${index}`}>{inline(heading[2])}</Tag>); index += 1; continue; }
    if (line.startsWith(">")) { blocks.push(<blockquote key={`quote-${index}`}>{inline(line.replace(/^>\s?/, ""))}</blockquote>); index += 1; continue; }
    const numbered = /^\d+\.\s+/.test(line); const bullet = /^[-*]\s+/.test(line); if (numbered || bullet) { const items: string[] = []; const pattern = numbered ? /^\d+\.\s+/ : /^[-*]\s+/; while (index < lines.length && pattern.test(lines[index])) { items.push(lines[index].replace(pattern, "")); index += 1; } const List = numbered ? "ol" : "ul"; blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</List>); continue; }
    const paragraph: string[] = [line]; index += 1; while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^>|^[-*]\s+|^\d+\.\s+/.test(lines[index])) { paragraph.push(lines[index]); index += 1; } blocks.push(<p key={`paragraph-${index}`}>{inline(paragraph.join(" "))}</p>);
  }
  return <div className="assistant-markdown">{blocks}</div>;
}
