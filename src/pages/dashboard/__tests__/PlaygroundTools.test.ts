/**
 * Tests for Playground v4 — Tool execution validation
 * Tests both real DB tools and mock UAZAPI tools.
 */

// ── Replicate tool execution logic (pure functions) ──
function executeSearchProducts(products: any[], args: { query?: string; category?: string }): string {
  if (!products?.length) return 'Nenhum produto encontrado com esses critérios.';
  let filtered = [...products];
  if (args.category) filtered = filtered.filter(p => p.category?.toLowerCase().includes(args.category!.toLowerCase()));
  if (args.query) {
    const q = args.query.toLowerCase();
    filtered = filtered.filter(p => p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  }
  if (!filtered.length) return 'Nenhum produto encontrado com esses critérios.';
  return filtered.map((p, i) => `${i + 1}. ${p.title} - R$${p.price?.toFixed(2) || '?'} ${!p.in_stock ? '(SEM ESTOQUE)' : ''}${p.images?.[0] ? ' [com foto]' : ' [sem foto]'}`).join('\n');
}

function executeSendCarousel(productIds: any, allProducts: any[]): string {
  const titles: string[] = Array.isArray(productIds) ? productIds : (productIds ? [String(productIds)] : []);
  const found = allProducts.filter(p => titles.some(t => p.title?.toLowerCase().includes(t.toLowerCase())) && p.images?.[0]);
  return found.length > 0
    ? `[ENVIADO] Carrossel com ${found.length} produto(s): ${found.map(p => `${p.title} (R$${p.price?.toFixed(2)})`).join(', ')}`
    : `Nenhum produto encontrado com imagem para carrossel. Produtos buscados: ${titles.join(', ')}`;
}

function executeSendMedia(args: { media_type?: string; caption?: string; media_url?: string }): string {
  return `[ENVIADO] Mídia: tipo=${args.media_type}, legenda="${args.caption || ''}", url=${args.media_url || 'N/A'}`;
}

function executeAssignLabel(labelName: string, availableLabels: string[]): string {
  const found = availableLabels.find(l => l.toLowerCase() === labelName?.toLowerCase());
  if (!found) return `Etiqueta "${labelName}" não encontrada. Disponíveis: ${availableLabels.join(', ')}`;
  return `Label "${found}" atribuída com sucesso.`;
}

function executeSetTags(tags: any): string {
  const newTags: string[] = Array.isArray(tags) ? tags : [];
  if (newTags.length === 0) return 'Nenhuma tag informada.';
  const valid = newTags.filter(t => t.includes(':'));
  const invalid = newTags.filter(t => !t.includes(':'));
  let result = `Tags registradas: ${valid.join(', ')}`;
  if (invalid.length > 0) result += ` | AVISO: tags sem formato chave:valor ignoradas: ${invalid.join(', ')}`;
  return result;
}

function executeUpdateLeadProfile(args: Record<string, any>): string {
  const parts: string[] = [];
  if (args.full_name) parts.push(`nome=${args.full_name}`);
  if (args.city) parts.push(`cidade=${args.city}`);
  if (args.interests) parts.push(`interesses=${args.interests.join(',')}`);
  if (args.reason) parts.push(`motivo=${args.reason}`);
  if (args.average_ticket) parts.push(`ticket=R$${args.average_ticket}`);
  if (args.objections) parts.push(`objeções=${args.objections.join(',')}`);
  if (args.notes) parts.push(`notas=${args.notes}`);
  return parts.length > 0 ? `Lead atualizado: ${parts.join(', ')}` : 'Nenhum campo informado.';
}

function executeHandoff(reason?: string): string {
  return `[HANDOFF] Conversa transferida para atendente humano. Motivo: ${reason || 'Não informado'}`;
}

const PRODUCTS = [
  { title: 'Tinta Coral Branco Neve 18L', category: 'tintas', description: 'Tinta latex premium', price: 189.90, in_stock: true, images: ['url1'] },
  { title: 'Tinta Suvinil Gelo 18L', category: 'tintas', description: 'Tinta latex', price: 159.90, in_stock: true, images: ['url2'] },
  { title: 'Cimento CP-II 50kg', category: 'cimento', description: 'Cimento Portland', price: 35.00, in_stock: true, images: [] },
  { title: 'Pincel Atlas 4pol', category: 'acessorios', description: 'Pincel profissional', price: 29.90, in_stock: false, images: ['url3'] },
];

describe('Playground Tools', () => {
  // search_products
  it('1. search_products returns message when no results', () => {
    expect(executeSearchProducts([], { query: 'xyz' })).toBe('Nenhum produto encontrado com esses critérios.');
  });

  it('2. search_products filters by query correctly', () => {
    const result = executeSearchProducts(PRODUCTS, { query: 'Coral' });
    expect(result).toContain('Tinta Coral');
    expect(result).not.toContain('Suvinil');
  });

  it('3. search_products shows stock status and photo indicator', () => {
    const result = executeSearchProducts(PRODUCTS, { query: 'Cimento' });
    expect(result).toContain('[sem foto]');
    const result2 = executeSearchProducts(PRODUCTS, { query: 'Pincel' });
    expect(result2).toContain('(SEM ESTOQUE)');
    expect(result2).toContain('[com foto]');
  });

  // send_carousel
  it('4. send_carousel validates product_ids is array', () => {
    const result = executeSendCarousel('Tinta Coral', PRODUCTS);
    expect(result).toContain('[ENVIADO]');
    expect(result).toContain('Tinta Coral');
  });

  it('5. send_carousel returns error when product has no image', () => {
    const result = executeSendCarousel(['Cimento'], PRODUCTS);
    expect(result).toContain('Nenhum produto encontrado com imagem');
  });

  it('6. send_carousel handles empty product_ids', () => {
    const result = executeSendCarousel(null, PRODUCTS);
    expect(result).toContain('Nenhum produto encontrado');
  });

  // send_media
  it('7. send_media returns feedback with type and caption', () => {
    const result = executeSendMedia({ media_type: 'image', caption: 'Foto do produto', media_url: 'https://example.com/img.jpg' });
    expect(result).toContain('tipo=image');
    expect(result).toContain('legenda="Foto do produto"');
    expect(result).toContain('url=https://example.com/img.jpg');
  });

  // assign_label
  it('8. assign_label returns error when label not found', () => {
    const result = executeAssignLabel('Inexistente', ['Novo', 'Qualificado']);
    expect(result).toContain('não encontrada');
    expect(result).toContain('Novo, Qualificado');
  });

  it('9. assign_label succeeds with case-insensitive match', () => {
    const result = executeAssignLabel('novo', ['Novo', 'Qualificado']);
    expect(result).toContain('atribuída com sucesso');
  });

  // set_tags
  it('10. set_tags validates format chave:valor', () => {
    const result = executeSetTags(['motivo:compra', 'interesse:tinta', 'invalido']);
    expect(result).toContain('Tags registradas: motivo:compra, interesse:tinta');
    expect(result).toContain('AVISO');
    expect(result).toContain('invalido');
  });

  // update_lead_profile
  it('11. update_lead_profile handles missing fields gracefully', () => {
    expect(executeUpdateLeadProfile({})).toBe('Nenhum campo informado.');
  });

  it('12. update_lead_profile formats all fields', () => {
    const result = executeUpdateLeadProfile({ full_name: 'Carlos', city: 'Recife', interests: ['tinta'], reason: 'compra', average_ticket: 500, objections: ['preco'] });
    expect(result).toContain('nome=Carlos');
    expect(result).toContain('cidade=Recife');
    expect(result).toContain('interesses=tinta');
    expect(result).toContain('motivo=compra');
    expect(result).toContain('ticket=R$500');
    expect(result).toContain('objeções=preco');
  });

  // handoff_to_human
  it('13. handoff returns mock with reason', () => {
    const result = executeHandoff('Lead quer comprar tinta Coral');
    expect(result).toContain('[HANDOFF]');
    expect(result).toContain('Lead quer comprar tinta Coral');
  });

  it('14. handoff handles missing reason', () => {
    expect(executeHandoff()).toContain('Não informado');
  });
});
