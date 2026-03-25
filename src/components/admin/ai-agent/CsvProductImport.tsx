import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, ArrowLeft, Check, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface CsvProductImportProps {
  agentId: string;
  existingProducts: Array<{ title: string; sku: string }>;
  onImported: () => void;
}

interface ParsedData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  title: number;
  price: number;
  description: number;
  category: number;
  subcategory: number;
  sku: number;
  images: number;
  stock: number;
}

// Auto-detect column by header name
const COLUMN_PATTERNS: Record<keyof ColumnMapping, string[]> = {
  title: ['título', 'titulo', 'nome', 'produto', 'name', 'title', 'product'],
  price: ['preço', 'preco', 'valor', 'price', 'vlr'],
  description: ['descrição', 'descricao', 'description', 'desc', 'detalhe'],
  category: ['categoria', 'category', 'cat', 'tipo'],
  subcategory: ['subcategoria', 'subcategory', 'sub'],
  sku: ['sku', 'código', 'codigo', 'cod', 'ref', 'referência', 'referencia'],
  images: ['imagem', 'imagens', 'foto', 'fotos', 'image', 'images', 'img', 'url_foto'],
  stock: ['estoque', 'stock', 'disponível', 'disponivel', 'ativo'],
};

function autoDetectColumn(headers: string[], field: keyof ColumnMapping): number {
  const patterns = COLUMN_PATTERNS[field];
  const idx = headers.findIndex(h =>
    patterns.some(p => h.toLowerCase().trim().includes(p))
  );
  return idx;
}

function parsePrice(raw: string): number {
  if (!raw || raw.trim() === '') return 0;
  const cleaned = raw.replace(/[rR]\$\s*/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0 ? 0 : num;
}

function parseImages(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[;,]/).map(u => u.trim()).filter(u => u.startsWith('http'));
}

function parseStock(raw: string): boolean {
  if (!raw) return true;
  const lower = raw.toLowerCase().trim();
  return !['0', 'não', 'nao', 'false', 'no', 'indisponível', 'indisponivel', 'esgotado'].includes(lower);
}

export function CsvProductImport({ agentId, existingProducts, onImported }: CsvProductImportProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'done'>('upload');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ title: -1, price: -1, description: -1, category: -1, subcategory: -1, sku: -1, images: -1, stock: -1 });
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ imported: number; duplicates: number; errors: number; errorRows: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parse file (CSV or Excel)
  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 10MB)'); return; }

    try {
      let rows: string[][] = [];
      let headers: string[] = [];

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const delimiter = detectDelimiter(lines[0]);
        rows = lines.map(l => parseCsvLine(l, delimiter));
      } else {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
        rows = data.map(r => r.map(String));
      }

      if (rows.length < 2) { toast.error('Arquivo deve ter pelo menos 2 linhas (cabeçalho + dados)'); return; }
      if (rows.length > 5001) { toast.error('Máximo 5000 produtos por importação'); return; }

      headers = rows[0];
      rows = rows.slice(1).filter(r => r.some(c => c.trim()));

      // Auto-detect columns
      const autoMapping: ColumnMapping = {
        title: autoDetectColumn(headers, 'title'),
        price: autoDetectColumn(headers, 'price'),
        description: autoDetectColumn(headers, 'description'),
        category: autoDetectColumn(headers, 'category'),
        subcategory: autoDetectColumn(headers, 'subcategory'),
        sku: autoDetectColumn(headers, 'sku'),
        images: autoDetectColumn(headers, 'images'),
        stock: autoDetectColumn(headers, 'stock'),
      };

      setParsed({ headers, rows });
      setMapping(autoMapping);
      setStep('mapping');
      toast.success(`${rows.length} linhas encontradas`);
    } catch (err) {
      toast.error('Erro ao ler arquivo');
      console.error(err);
    }
  };

  // Import products
  const handleImport = async () => {
    if (!parsed || mapping.title < 0) { toast.error('Mapeie a coluna de título'); return; }
    setImporting(true); setStep('importing'); setProgress(0);

    const existingTitles = new Set(existingProducts.map(p => p.title.toLowerCase()));
    const existingSkus = new Set(existingProducts.filter(p => p.sku).map(p => p.sku.toLowerCase()));

    let imported = 0, duplicates = 0, errors = 0;
    const errorRows: string[] = [];
    const CHUNK = 50;
    const products: any[] = [];

    // Validate and build products
    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const title = (row[mapping.title] || '').trim();

      if (!title || title.length < 3) {
        errors++;
        errorRows.push(`Linha ${i + 2}: título vazio ou muito curto`);
        continue;
      }

      // Dedup
      const sku = mapping.sku >= 0 ? (row[mapping.sku] || '').trim() : '';
      if (existingTitles.has(title.toLowerCase()) || (sku && existingSkus.has(sku.toLowerCase()))) {
        duplicates++;
        continue;
      }
      existingTitles.add(title.toLowerCase());
      if (sku) existingSkus.add(sku.toLowerCase());

      products.push({
        agent_id: agentId,
        title,
        price: mapping.price >= 0 ? parsePrice(row[mapping.price]) : 0,
        description: mapping.description >= 0 ? (row[mapping.description] || '').trim() : '',
        category: mapping.category >= 0 ? (row[mapping.category] || '').trim() : '',
        subcategory: mapping.subcategory >= 0 ? (row[mapping.subcategory] || '').trim() : '',
        sku,
        images: mapping.images >= 0 ? parseImages(row[mapping.images]) : [],
        in_stock: mapping.stock >= 0 ? parseStock(row[mapping.stock]) : true,
        enabled: true,
        position: existingProducts.length + imported,
      });
      imported++;
    }

    // Batch insert
    for (let i = 0; i < products.length; i += CHUNK) {
      const chunk = products.slice(i, i + CHUNK);
      const { error } = await supabase.from('ai_agent_products').insert(chunk);
      if (error) {
        errors += chunk.length;
        imported -= chunk.length;
        errorRows.push(`Batch ${Math.floor(i / CHUNK) + 1}: ${error.message}`);
      }
      setProgress(Math.round(((i + chunk.length) / products.length) * 100));
    }

    setResults({ imported, duplicates, errors, errorRows });
    setImporting(false); setStep('done');
    if (imported > 0) onImported();
    toast.success(`${imported} produtos importados${duplicates ? `, ${duplicates} duplicados` : ''}${errors ? `, ${errors} erros` : ''}`);
  };

  const reset = () => { setStep('upload'); setParsed(null); setResults(null); setProgress(0); };

  // Step: Upload
  if (step === 'upload') return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
      <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
        <FileSpreadsheet className="w-4 h-4" /> Selecionar arquivo CSV ou Excel
      </Button>
      <p className="text-[11px] text-muted-foreground text-center">
        Formatos: .csv, .xlsx, .xls (máx 10MB, 5000 produtos). Primeira linha = cabeçalho.
      </p>
    </div>
  );

  // Step: Column mapping
  if (step === 'mapping' && parsed) {
    const validCount = parsed.rows.filter(r => (r[mapping.title] || '').trim().length >= 3).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={reset}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar</Button>
          <Badge variant="secondary">{parsed.rows.length} linhas</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(COLUMN_PATTERNS) as (keyof ColumnMapping)[]).map(field => (
            <div key={field} className="space-y-1">
              <Label className="text-xs capitalize">{field === 'title' ? 'Título *' : field === 'stock' ? 'Estoque' : field}</Label>
              <Select value={String(mapping[field])} onValueChange={v => setMapping(m => ({ ...m, [field]: parseInt(v) }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Não mapear" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-1">— Não mapear —</SelectItem>
                  {parsed.headers.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>{h || `Coluna ${i + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Preview */}
        <ScrollArea className="h-[200px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {parsed.headers.map((h, i) => (
                  <TableHead key={i} className={`text-xs whitespace-nowrap ${Object.values(mapping).includes(i) ? 'bg-primary/10 text-primary font-bold' : ''}`}>
                    {h || `Col ${i + 1}`}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.rows.slice(0, 5).map((row, ri) => (
                <TableRow key={ri}>
                  {row.map((cell, ci) => (
                    <TableCell key={ci} className={`text-xs truncate max-w-[150px] ${Object.values(mapping).includes(ci) ? 'bg-primary/5' : ''}`}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {mapping.title >= 0 ? <><Check className="w-3 h-3 inline text-emerald-500" /> {validCount} produtos válidos</> : <><AlertCircle className="w-3 h-3 inline text-orange-500" /> Mapeie a coluna de título</>}
          </p>
          <Button size="sm" disabled={mapping.title < 0} onClick={handleImport}>
            <Upload className="w-3.5 h-3.5 mr-1" /> Importar {validCount} produtos
          </Button>
        </div>
      </div>
    );
  }

  // Step: Importing
  if (step === 'importing') return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <p className="text-sm">Importando produtos...</p>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-center text-muted-foreground">{progress}%</p>
    </div>
  );

  // Step: Done
  if (step === 'done' && results) return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-3 rounded-lg bg-emerald-500/10">
          <p className="text-lg font-bold text-emerald-500">{results.imported}</p>
          <p className="text-[11px] text-muted-foreground">Importados</p>
        </div>
        <div className="p-3 rounded-lg bg-orange-500/10">
          <p className="text-lg font-bold text-orange-500">{results.duplicates}</p>
          <p className="text-[11px] text-muted-foreground">Duplicados</p>
        </div>
        <div className="p-3 rounded-lg bg-red-500/10">
          <p className="text-lg font-bold text-red-500">{results.errors}</p>
          <p className="text-[11px] text-muted-foreground">Erros</p>
        </div>
      </div>
      {results.errorRows.length > 0 && (
        <ScrollArea className="h-[100px] border rounded-lg p-2">
          {results.errorRows.map((e, i) => (
            <p key={i} className="text-xs text-red-400">{e}</p>
          ))}
        </ScrollArea>
      )}
      <Button variant="outline" size="sm" className="w-full" onClick={reset}>Importar outro arquivo</Button>
    </div>
  );

  return null;
}

// ── Helpers reutilizados do CsvTab ──
function detectDelimiter(line: string): string {
  const sc = (line.match(/;/g) || []).length;
  const cm = (line.match(/,/g) || []).length;
  const tb = (line.match(/\t/g) || []).length;
  if (tb > 0 && tb >= sc && tb >= cm) return '\t';
  return sc > cm ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += c;
  }
  result.push(current.trim());
  return result;
}
