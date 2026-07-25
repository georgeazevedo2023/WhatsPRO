import { describe, it, expect } from 'vitest';
import {
  buildDailyReportText,
  fmtMinutes,
  isHourInBusinessHours,
  median,
  npsBucket,
  weekdayKey,
  type DailyReportData,
} from './dailyReport';

const WEEKLY_HOURS = {
  mon: { open: true, start: '08:00', end: '18:00' },
  tue: { open: true, start: '08:00', end: '18:00' },
  wed: { open: true, start: '08:00', end: '18:00' },
  thu: { open: true, start: '08:00', end: '18:00' },
  fri: { open: true, start: '08:00', end: '18:00' },
  sat: { open: true, start: '08:00', end: '12:00' },
  sun: { open: false },
};

function baseData(overrides: Partial<DailyReportData> = {}): DailyReportData {
  return {
    day: '2026-07-24', // sexta
    inbound_total: 0,
    inbound_by_hour: {},
    conversations_total: 0,
    conversations_new: 0,
    conv_starts_by_hour: {},
    ai_only: 0,
    handoffs_total: 0,
    handoff_first_response_minutes: [],
    sales: 0,
    nps_votes: [],
    top_searches: [],
    top_brands: [],
    ...overrides,
  };
}

describe('weekdayKey', () => {
  it('resolve o dia da semana independente do fuso do runner', () => {
    expect(weekdayKey('2026-07-24')).toBe('fri');
    expect(weekdayKey('2026-07-25')).toBe('sat');
    expect(weekdayKey('2026-07-26')).toBe('sun');
  });
});

describe('isHourInBusinessHours', () => {
  it('classifica horas úteis e fora do expediente (weekly)', () => {
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'fri', 7)).toBe(false); // 07:30 < 08:00
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'fri', 8)).toBe(true);
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'fri', 17)).toBe(true); // 17:30 < 18:00
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'fri', 18)).toBe(false);
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'sat', 11)).toBe(true); // sáb até 12h
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'sat', 12)).toBe(false);
  });

  it('domingo fechado → toda hora fora; sem config → 24/7', () => {
    expect(isHourInBusinessHours(WEEKLY_HOURS, 'sun', 10)).toBe(false);
    expect(isHourInBusinessHours(null, 'sun', 3)).toBe(true);
    expect(isHourInBusinessHours(undefined, 'mon', 23)).toBe(true);
  });

  it('formato legacy {start,end} sem dias', () => {
    expect(isHourInBusinessHours({ start: '09:00', end: '19:00' }, 'mon', 8)).toBe(false);
    expect(isHourInBusinessHours({ start: '09:00', end: '19:00' }, 'mon', 9)).toBe(true);
  });
});

describe('median', () => {
  it('mediana ímpar, par e vazia', () => {
    expect(median([12])).toBe(12);
    expect(median([5, 60, 30])).toBe(30);
    expect(median([10, 20])).toBe(15);
    expect(median([])).toBeNull();
  });
});

describe('npsBucket', () => {
  it('bucketiza por numeric_score (Bom→8 / Regular→5 / Ruim→2)', () => {
    expect(npsBucket({ score: 8, options: null })).toBe('Bom');
    expect(npsBucket({ score: 5, options: null })).toBe('Regular');
    expect(npsBucket({ score: 2, options: null })).toBe('Ruim');
  });
  it('fallback pelas options quando score é null', () => {
    expect(npsBucket({ score: null, options: ['1-Bom'] })).toBe('Bom');
    expect(npsBucket({ score: null, options: ['3-Ruim'] })).toBe('Ruim');
    expect(npsBucket({ score: null, options: [] })).toBeNull();
  });
});

describe('buildDailyReportText', () => {
  it('números fecham: atendimentos = novos + recorrentes; histograma soma o total', () => {
    const text = buildDailyReportText({
      title: 'Eletropiso',
      businessHours: WEEKLY_HOURS,
      cutoffLabel: 'até 17h30',
      data: baseData({
        inbound_total: 20,
        inbound_by_hour: { '7': 2, '9': 10, '14': 8 },
        conversations_total: 6,
        conversations_new: 4,
        conv_starts_by_hour: { '9': 5, '14': 1 },
        ai_only: 5,
        sales: 2,
      }),
    });
    expect(text).toContain('📊 *Resumo do dia — Eletropiso*');
    expect(text).toContain('24/07/2026 · até 17h30');
    expect(text).toContain('👥 *Atendimentos:* 6 (4 novos · 2 recorrentes)');
    expect(text).toContain('💬 *Mensagens recebidas:* 20 (18 no horário · 2 fora)');
    expect(text).toContain('🤖 *Só com a IA (sem humano):* 5 de 6 (83%)');
    expect(text).toContain('💰 *Vendas detectadas:* 2');
    // histograma: faixa contínua 09h..14h com zeros no meio
    expect(text).toContain('09h ▓▓▓▓▓▓▓▓ 5');
    expect(text).toContain('10h 0');
    expect(text).toContain('14h ▓▓ 1');
  });

  it('marca "(fora do horário)" nas horas fora do expediente do dia', () => {
    const text = buildDailyReportText({
      title: 'Eletropiso',
      businessHours: WEEKLY_HOURS,
      data: baseData({
        conversations_total: 3,
        conversations_new: 3,
        inbound_total: 3,
        inbound_by_hour: { '7': 1, '8': 2 },
        conv_starts_by_hour: { '7': 1, '8': 2 },
        ai_only: 3,
      }),
    });
    expect(text).toContain('07h ▓▓▓▓ 1 _(fora do horário)_');
    expect(text).toContain('08h ▓▓▓▓▓▓▓▓ 2');
    expect(text).not.toContain('08h ▓▓▓▓▓▓▓▓ 2 _(fora do horário)_');
  });

  it('sábado usa a janela do sábado (08-12): 13h é fora', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: WEEKLY_HOURS,
      data: baseData({
        day: '2026-07-25', // sábado
        conversations_total: 2,
        conversations_new: 1,
        inbound_total: 2,
        inbound_by_hour: { '11': 1, '13': 1 },
        conv_starts_by_hour: { '11': 1, '13': 1 },
        ai_only: 2,
      }),
    });
    expect(text).toContain('💬 *Mensagens recebidas:* 2 (1 no horário · 1 fora)');
    expect(text).toContain('13h ▓▓▓▓▓▓▓▓ 1 _(fora do horário)_');
  });

  it('transbordos: mediana da 1ª resposta humana + pendentes destacados', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({
        handoffs_total: 3,
        handoff_first_response_minutes: [12, 40],
      }),
    });
    expect(text).toContain('🤝 *Transbordos:* 3 · 1ª resposta humana em 26min · ⚠️ 1 sem resposta');
  });

  it('transbordo sem NENHUMA resposta humana vira alerta', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({ handoffs_total: 1, handoff_first_response_minutes: [] }),
    });
    expect(text).toContain('🤝 *Transbordos:* 1 · ⚠️ nenhum respondido por humano ainda');
  });

  it('dia vazio: sem seções de produto/NPS/histograma, sem crash, sem NaN', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: WEEKLY_HOURS,
      data: baseData(),
    });
    expect(text).toContain('👥 *Atendimentos:* 0');
    expect(text).toContain('🤝 *Transbordos:* 0');
    expect(text).not.toContain('🛒');
    expect(text).not.toContain('⭐');
    expect(text).not.toContain('🕐');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('undefined');
  });

  it('top produtos: máx 5, capitalizados, com contagem; marcas em linha única', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({
        top_searches: [
          { q: 'telha pvc', n: 7 },
          { q: 'tinta suvinil', n: 3 },
          { q: 'a', n: 2 }, { q: 'b', n: 2 }, { q: 'c', n: 1 }, { q: 'd', n: 1 },
        ],
        top_brands: [{ b: 'suvinil', n: 3 }, { b: 'hdl', n: 1 }],
      }),
    });
    expect(text).toContain('1. Telha pvc — 7 buscas');
    expect(text).toContain('2. Tinta suvinil — 3 buscas');
    expect(text).toContain('5. C — 1 busca');
    expect(text).not.toContain('6. ');
    expect(text).toContain('🏷️ *Marcas citadas:* Suvinil (3) · HDL (1)');
  });

  it('marcas: top 5 com display de slug (sigla, multi-palavra)', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({
        top_brands: [
          { b: 'brasilit', n: 5 }, { b: 'la_fonte', n: 3 }, { b: 'sherwin_williams', n: 2 },
          { b: 'weg', n: 2 }, { b: 'lorenzetti', n: 1 }, { b: 'coral', n: 1 },
        ],
      }),
    });
    expect(text).toContain(
      '🏷️ *Marcas citadas:* Brasilit (5) · La Fonte (3) · Sherwin Williams (2) · WEG (2) · Lorenzetti (1)',
    );
    // corta no 5º — 'coral' fica de fora
    expect(text).not.toContain('Coral (1)');
  });

  it('formato RICO (v7.108.0): deltas vs mesmo dia da semana anterior + sub-linhas ↳', () => {
    const text = buildDailyReportText({
      title: 'EletropisoV2',
      businessHours: WEEKLY_HOURS,
      data: baseData({
        // sex 24/07 vs sex 17/07
        inbound_total: 110,
        inbound_by_hour: { '9': 100, '19': 10 }, // 19h = fora (sex fecha 18h)
        conversations_total: 50,
        conversations_new: 30,
        conv_starts_by_hour: { '9': 50 },
        ai_only: 10,
        handoffs_total: 4,
        handoff_first_response_minutes: [120, 300], // mediana 210 → 3h30
        sales: 0,
        nps_sent: 0,
        human_panel_msgs: 0,
        human_panel_convs: 0,
        category_mentions: [
          { c: 'Tinta', msgs: 5, convs: 4 },
          { c: 'Telha', msgs: 3, convs: 2 },
        ],
        top_searches: [{ q: 'ignorado', n: 1 }], // rico usa categorias, não buscas
        prev: {
          day: '2026-07-17',
          conversations_total: 40,
          conversations_new: 20,
          inbound_total: 100,
          handoffs_total: 2,
          sales: 1,
        },
      }),
    });
    expect(text).toContain('👥 *Atendimentos:* 50 ▲25% (sex ant.: 40)');
    expect(text).toContain('↳ 30 novos · 20 recorrentes');
    expect(text).toContain('💬 *Mensagens recebidas:* 110 ▲10% (sex ant.: 100)');
    expect(text).toContain('↳ 100 no horário · 10 fora');
    // base pequena (<10) não vira % — mostra só o valor anterior
    expect(text).toContain('🤝 *Transbordos:* 4 (sex ant.: 2) · 1ª resposta humana em 3h30 · ⚠️ 2 sem resposta');
    expect(text).toContain('💰 *Vendas detectadas:* 0 (sex ant.: 1)');
    expect(text).toContain('⭐ *NPS:* 0 enquetes enviadas · 0 votos');
    expect(text).toContain('🛒 *O que procuraram* (nº de conversas):');
    expect(text).toContain('1. Tinta — 4');
    expect(text).toContain('2. Telha — 2');
    expect(text).not.toContain('Top produtos procurados');
  });

  it('formato RICO: pontos de atenção disparam pelas regras determinísticas', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: WEEKLY_HOURS,
      data: baseData({
        inbound_total: 20,
        inbound_by_hour: { '9': 14, '20': 6 }, // 6 fora ≥5 → atenção
        conversations_total: 10,
        conversations_new: 10,
        conv_starts_by_hour: { '9': 10 },
        handoffs_total: 3,
        handoff_first_response_minutes: [232], // mediana 3h52 > 60min
        nps_sent: 0,
        human_panel_msgs: 0,
      }),
    });
    expect(text).toContain('⚠️ *Pontos de atenção:*');
    expect(text).toContain('1ª resposta humana demorou: mediana 3h52');
    expect(text).toContain('2 transbordos sem resposta humana');
    expect(text).toContain('Respostas humanas vieram só do celular — sem medição por atendente no painel');
    expect(text).toContain('Nenhuma enquete NPS disparou — a enquete sai ao Finalizar a conversa no painel');
    expect(text).toContain('6 mensagens fora do horário — cliente chama com a loja fechada');
  });

  it('formato RICO: enquete enviada sem voto vira atenção; painel usado não alerta', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({
        conversations_total: 5,
        conversations_new: 5,
        inbound_total: 10,
        inbound_by_hour: { '9': 10 },
        conv_starts_by_hour: { '9': 5 },
        handoffs_total: 1,
        handoff_first_response_minutes: [3],
        nps_sent: 2,
        human_panel_msgs: 7,
      }),
    });
    expect(text).toContain('⭐ *NPS:* 2 enquetes enviadas · 0 votos');
    expect(text).toContain('2 enquetes NPS enviadas sem nenhum voto');
    expect(text).not.toContain('só do celular');
    expect(text).not.toContain('demorou');
  });

  it('fmtMinutes: minutos e horas', () => {
    expect(fmtMinutes(26)).toBe('26min');
    expect(fmtMinutes(60)).toBe('1h00');
    expect(fmtMinutes(232)).toBe('3h52');
  });

  it('NPS agregado por bucket quando há votos', () => {
    const text = buildDailyReportText({
      title: 'X',
      businessHours: null,
      data: baseData({
        nps_votes: [
          { score: 8, options: null },
          { score: 8, options: null },
          { score: 5, options: null },
        ],
      }),
    });
    expect(text).toContain('⭐ *NPS:* 3 votos (2 Bom · 1 Regular)');
  });
});
