// Canal de controle E2E (2026-05-23) — webhook que a instância UAZAPI "Testador
// Wsmart" chama em toda mensagem recebida. Filtra apenas as mensagens vindas do
// operador humano (número configurado) e grava em e2e_control_inbox, de onde o
// orquestrador (Claude Code) lê os comandos e responde via UAZAPI /send/text.
//
// Por que existe: dá um canal bidirecional WhatsApp pro operador comandar a sessão
// (rodar cenário, deployar, etc.) sem estar no terminal. NÃO processa as respostas
// que o agente Eletropiso devolve ao Testador durante os testes (essas têm
// fromMe=false mas sender != operador, então são ignoradas).
//
// verify_jwt=false (config.toml): UAZAPI não envia Authorization header.
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Número do operador (com e sem o 9º dígito — WhatsApp normaliza de formas diferentes).
const OPERATOR_DIGITS = ['5581993856099', '558193856099']

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '')

function isFromOperator(sender: string): boolean {
  const d = onlyDigits(sender)
  return OPERATOR_DIGITS.some((op) => d === op || d.endsWith(op) || d.endsWith(op.replace(/^55/, '')))
}

// UAZAPI manda formatos variados (event wrapper OU mensagem raw). Extrai de forma defensiva.
// IMPORTANTE: `message.sender` pode vir como LID interno (ex: 90044006187258@lid),
// NÃO o telefone. O número real está em `sender_pn` / `chatid` (558193856099@s.whatsapp.net).
function parseMessage(payload: any): { fromMe: boolean; sender: string; text: string } {
  const msg = payload?.message ?? payload?.data?.message ?? payload ?? {}
  const fromMe = (msg.fromMe ?? payload?.fromMe) === true
  const sender = msg.sender_pn || msg.chatid || payload?.sender_pn || payload?.chatid ||
    msg.sender || payload?.sender || payload?.owner || ''
  const text = (typeof msg.text === 'string' && msg.text) ||
    msg.content?.text || (typeof msg.content === 'string' && msg.content) ||
    payload?.text || payload?.content?.text || msg.conversation || ''
  return { fromMe, sender: String(sender), text: String(text) }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  let payload: any = {}
  try { payload = await req.json() } catch { /* corpo vazio/inválido — ignora */ }

  try {
    const { fromMe, sender, text } = parseMessage(payload)

    // Só comandos recebidos (não enviados por nós) e vindos do operador.
    if (!fromMe && text.trim() && isFromOperator(sender)) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      await supabase.from('e2e_control_inbox').insert({
        from_number: onlyDigits(sender),
        body: text.trim(),
        raw: payload,
      })
    }
  } catch (err) {
    // Nunca falhar o webhook (UAZAPI poderia re-tentar) — só loga.
    console.error('e2e-control-webhook error:', (err as Error).message)
  }

  // 200 sempre.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
