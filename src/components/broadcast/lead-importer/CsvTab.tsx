import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { parsePhoneToJid, formatPhoneDisplay } from '@/lib/phoneUtils';
import * as XLSX from 'xlsx';
import type { Lead } from '@/pages/dashboard/LeadsBroadcaster';

interface ParsedFileData {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
}

interface CsvTabProps {
  onLeadsImported: (leads: Lead[]) => void;
}

// ── CSV helper functions ─────────────────────────────────────────────

const detectDelimiter = (line: string): string => {
  const semicolonCount = (line.match(/;/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  const tabCount = (line.match(/\t/g) || []).length;
  if (tabCount > 0 && tabCount >= semicolonCount && tabCount >= commaCount) return '\t';
  if (semicolonCount > commaCount) return ';';
  return ',';
};

const detectHeader = (line: string): boolean => {
  const headerKeywords = ['nome', 'name', 'telefone', 'phone', 'numero', 'número', 'celular', 'whatsapp', 'contato'];
  const lowerLine = line.toLowerCase();
  return headerKeywords.some(keyword => lowerLine.includes(keyword));
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
};

const findPhoneAndNameColumns = (values: string[]): { phoneIndex: number; nameIndex: number } => {
  let phoneIndex = -1;
  let nameIndex = -1;
  values.forEach((value, index) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 10 && phoneIndex === -1) phoneIndex = index;
  });
  values.forEach((value, index) => {
    if (index !== phoneIndex && value.length > 0 && !/^\d+$/.test(value.replace(/\D/g, ''))) {
      if (nameIndex === -1) nameIndex = index;
    }
  });
  return { phoneIndex, nameIndex };
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 50000;

const isValidFileType = (fileName: string): boolean => {
  const ext = fileName.toLowerCase();
  return ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls');
};

/** Sanitize cell value to prevent CSV injection (formulas starting with =, +, -, @) */
const sanitizeCell = (value: string): string => {
  if (!value) return value;
  const trimmed = value.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return "'" + trimmed;
  }
  return trimmed;
};

const processExcelFile = async (file: File): Promise<string[][]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: '' });
  return data.filter(row => row.some(cell => cell?.toString().trim()));
};

// ── Component ────────────────────────────────────────────────────────

const CsvTab = ({ onLeadsImported }: CsvTabProps) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [phoneColumnIndex, setPhoneColumnIndex] = useState<number>(-1);
  const [nameColumnIndex, setNameColumnIndex] = useState<number>(-1);
  const [showColumnMapping, setShowColumnMapping] = useState(false);

  const resetFileState = () => {
    setCsvFile(null);
    setParsedData(null);
    setPhoneColumnIndex(-1);
    setNameColumnIndex(-1);
    setShowColumnMapping(false);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const parseFileForMapping = async (file: File) => {
    setIsProcessingCsv(true);
    try {
      const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
      let dataRows: string[][];

      if (isExcel) {
        dataRows = await processExcelFile(file);
      } else {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) { toast.error('Arquivo vazio'); setIsProcessingCsv(false); return; }
        const delimiter = detectDelimiter(lines[0]);
        dataRows = lines.map(line => parseCsvLine(line, delimiter));
      }

      if (dataRows.length === 0) { toast.error('Arquivo vazio'); setIsProcessingCsv(false); return; }

      // Limit rows and sanitize cells
      if (dataRows.length > MAX_ROWS) {
        toast.error(`Arquivo muito grande (${dataRows.length} linhas). Máximo: ${MAX_ROWS.toLocaleString()}`);
        setIsProcessingCsv(false);
        return;
      }
      dataRows = dataRows.map(row => row.map(cell => sanitizeCell(cell?.toString() || '')));

      const firstRowStr = dataRows[0].map(v => v?.toString().toLowerCase() || '').join(' ');
      const hasHeader = detectHeader(firstRowStr);
      const columnCount = Math.max(...dataRows.map(r => r.length));

      let headers: string[];
      let rows: string[][];

      if (hasHeader) {
        headers = dataRows[0].map((v, i) => v?.toString().trim() || `Coluna ${String.fromCharCode(65 + i)}`);
        rows = dataRows.slice(1);
      } else {
        headers = Array.from({ length: columnCount }, (_, i) => `Coluna ${String.fromCharCode(65 + i)}`);
        rows = dataRows;
      }

      if (rows.length === 0) { toast.error('Nenhum dado encontrado no arquivo'); setIsProcessingCsv(false); return; }

      const firstRowValues = rows[0].map(v => v?.toString() || '');
      const { phoneIndex, nameIndex } = findPhoneAndNameColumns(firstRowValues);

      setParsedData({ headers, rows, hasHeader });
      setPhoneColumnIndex(phoneIndex);
      setNameColumnIndex(nameIndex);
      setShowColumnMapping(true);
    } catch (error) {
      handleError(error, 'Erro ao processar o arquivo', 'Parse CSV');
    } finally {
      setIsProcessingCsv(false);
    }
  };

  const validateAndProcessFile = async (file: File) => {
    if (!isValidFileType(file.name)) {
      toast.error('Por favor, selecione um arquivo .csv, .xlsx ou .xls');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`Arquivo muito grande (máx. ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }
    setCsvFile(file);
    await parseFileForMapping(file);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await validateAndProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await validateAndProcessFile(file);
  };

  const handleConfirmMapping = () => {
    if (!parsedData || phoneColumnIndex === -1) { toast.error('Selecione a coluna de telefone'); return; }

    const leads: Lead[] = [];
    const errors: string[] = [];

    parsedData.rows.forEach((row, index) => {
      const phoneValue = row[phoneColumnIndex]?.toString() || '';
      const nameValue = nameColumnIndex >= 0 ? row[nameColumnIndex]?.toString() : undefined;
      const jid = parsePhoneToJid(phoneValue);
      if (jid) {
        leads.push({ id: crypto.randomUUID(), phone: formatPhoneDisplay(phoneValue), name: nameValue?.trim() || undefined, jid, source: 'paste' });
      } else if (phoneValue.trim()) {
        errors.push(`Linha ${index + 1 + (parsedData.hasHeader ? 1 : 0)}: "${phoneValue}" - número inválido`);
      }
    });

    if (leads.length > 0) {
      onLeadsImported(leads);
      resetFileState();
      toast.success(`${leads.length} contato${leads.length !== 1 ? 's' : ''} importado${leads.length !== 1 ? 's' : ''}`);
    } else {
      toast.error('Nenhum contato válido encontrado no arquivo');
    }

    if (errors.length > 0 && errors.length <= 3) {
      errors.forEach(err => toast.error(err));
    } else if (errors.length > 3) {
      toast.error(`${errors.length} números inválidos não foram importados`);
    }
  };

  if (!showColumnMapping) {
    return (
      <div className="space-y-4">
        <div>
          <Label>Arquivo CSV ou Excel</Label>
          <p className="text-xs text-muted-foreground mb-2">
            O arquivo deve conter uma coluna com números de telefone. Opcionalmente pode ter uma coluna com nomes.
          </p>
        </div>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => csvInputRef.current?.click()}
        >
          <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          {isProcessingCsv ? (
            <>
              <Loader2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground animate-spin" />
              <p className="font-medium">Processando arquivo...</p>
            </>
          ) : (
            <>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">ou arraste o arquivo aqui</p>
              <p className="text-xs text-muted-foreground mt-3">Formatos: .csv, .xlsx, .xls</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!parsedData) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={resetFileState}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Badge variant="outline">
          {csvFile?.name} • {parsedData.rows.length} linha{parsedData.rows.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Coluna de Telefone *</Label>
              <Select value={phoneColumnIndex >= 0 ? phoneColumnIndex.toString() : ''} onValueChange={(v) => setPhoneColumnIndex(parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger>
                <SelectContent>
                  {parsedData.headers.map((header, index) => (
                    <SelectItem key={index} value={index.toString()}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coluna de Nome (opcional)</Label>
              <Select value={nameColumnIndex >= 0 ? nameColumnIndex.toString() : 'none'} onValueChange={(v) => setNameColumnIndex(v === 'none' ? -1 : parseInt(v))}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {parsedData.headers.map((header, index) => (
                    <SelectItem key={index} value={index.toString()} disabled={index === phoneColumnIndex}>{header}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <Label className="mb-2 block">Preview (primeiras 5 linhas)</Label>
        <div className="border rounded-lg overflow-hidden">
          <ScrollArea className="max-h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  {parsedData.headers.map((header, index) => (
                    <TableHead
                      key={index}
                      className={`whitespace-nowrap ${
                        index === phoneColumnIndex ? 'bg-primary/10 text-primary'
                          : index === nameColumnIndex ? 'bg-secondary' : ''
                      }`}
                    >
                      {header}
                      {index === phoneColumnIndex && <Badge className="ml-2 text-xs" variant="default">Tel</Badge>}
                      {index === nameColumnIndex && <Badge className="ml-2 text-xs" variant="secondary">Nome</Badge>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedData.rows.slice(0, 5).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {parsedData.headers.map((_, colIndex) => (
                      <TableCell
                        key={colIndex}
                        className={`whitespace-nowrap ${
                          colIndex === phoneColumnIndex ? 'bg-primary/5 font-medium'
                            : colIndex === nameColumnIndex ? 'bg-secondary/50' : ''
                        }`}
                      >
                        {row[colIndex]?.toString() || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={resetFileState}>Cancelar</Button>
        <Button onClick={handleConfirmMapping} disabled={phoneColumnIndex === -1}>
          <Check className="w-4 h-4 mr-2" />
          Importar {parsedData.rows.length} contato{parsedData.rows.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
};

export default CsvTab;
