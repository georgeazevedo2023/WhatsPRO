import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Loader2, X } from 'lucide-react';

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  version: string;
  content: string;
}

const renderMarkdown = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let codeBlock: string[] | null = null;
  let codeBlockLang = '';
  let tableRows: string[] | null = null;
  let key = 0;

  const flushTable = () => {
    if (!tableRows || tableRows.length === 0) return;
    const headers = tableRows[0].split('|').filter(c => c.trim()).map(c => c.trim());
    const dataRows = tableRows.slice(2); // skip separator
    elements.push(
      <div key={key++} className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h, hi) => (
                <th key={hi} className="text-left p-2 font-semibold text-foreground/90 bg-muted/30">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => {
              const cells = row.split('|').filter(c => c.trim()).map(c => c.trim());
              return (
                <tr key={ri} className="border-b border-border/50 hover:bg-muted/20">
                  {cells.map((cell, ci) => (
                    <td key={ci} className="p-2 text-foreground/80">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = null;
  };

  const renderInline = (text: string): React.ReactNode => {
    // Bold, inline code, links
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(\\[|]|[❌✅])/g;
    let lastIndex = 0;
    let match;
    let partKey = 0;

    const str = text.replace(/\\`/g, '`').replace(/\\\|/g, '|');
    
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={partKey++} className="font-semibold text-foreground">{match[2]}</strong>);
      } else if (match[4]) {
        parts.push(<code key={partKey++} className="bg-muted/60 text-primary/90 px-1.5 py-0.5 rounded text-xs font-mono">{match[4]}</code>);
      } else if (match[6]) {
        parts.push(<a key={partKey++} href={match[7]} target="_blank" rel="noopener noreferrer" className="text-primary underline">{match[6]}</a>);
      } else {
        parts.push(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < str.length) parts.push(str.slice(lastIndex));
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith('```')) {
      if (codeBlock !== null) {
        elements.push(
          <pre key={key++} className="bg-muted/40 border border-border/50 rounded-lg p-4 my-3 overflow-x-auto">
            <code className="text-xs font-mono text-foreground/90 whitespace-pre">{codeBlock.join('\n')}</code>
          </pre>
        );
        codeBlock = null;
      } else {
        flushTable();
        codeBlockLang = line.slice(3).trim();
        codeBlock = [];
      }
      i++;
      continue;
    }
    if (codeBlock !== null) {
      codeBlock.push(line);
      i++;
      continue;
    }

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!tableRows) tableRows = [];
      tableRows.push(line);
      i++;
      continue;
    } else {
      flushTable();
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-2xl font-display font-bold text-foreground mt-8 mb-3 first:mt-0">{line.slice(2)}</h1>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-xl font-display font-bold text-foreground mt-8 mb-2 border-b border-border/40 pb-2">{line.slice(3)}</h2>);
      i++; continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-lg font-semibold text-foreground mt-6 mb-2">{line.slice(4)}</h3>);
      i++; continue;
    }
    if (line.startsWith('#### ')) {
      elements.push(<h4 key={key++} className="text-base font-semibold text-foreground/90 mt-4 mb-1">{renderInline(line.slice(5))}</h4>);
      i++; continue;
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(<hr key={key++} className="border-border/30 my-4" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-primary/40 bg-primary/5 pl-4 py-2 my-3 text-sm text-foreground/80 italic rounded-r">
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // List items
    if (line.match(/^[\-\*] /)) {
      elements.push(<li key={key++} className="text-sm text-foreground/80 ml-4 list-disc my-0.5">{renderInline(line.slice(2))}</li>);
      i++; continue;
    }
    if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\.\s/, '');
      elements.push(<li key={key++} className="text-sm text-foreground/80 ml-4 list-decimal my-0.5">{renderInline(text)}</li>);
      i++; continue;
    }

    // Regular paragraph
    elements.push(<p key={key++} className="text-sm text-foreground/80 my-1.5 leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  flushTable();
  return elements;
};

const DocumentViewer: React.FC<DocumentViewerProps> = ({ open, onOpenChange, title, version, content }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRD_${title.replace(/[\s\/]+/g, '_')}_${version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setGeneratingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#1a1a2e',
      });

      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      let position = 0;
      let heightLeft = imgHeight;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`PRD_${title.replace(/[\s\/]+/g, '_')}_${version}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-display">{title}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-1">
                Versão {version} — PRD completo do módulo
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadMd}>
                <Download className="w-4 h-4" />
                .md
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPdf} disabled={generatingPdf}>
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                .pdf
              </Button>
            </div>
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1 p-6">
          <div ref={contentRef} className="prose-sm max-w-none">
            {renderMarkdown(content)}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default DocumentViewer;
