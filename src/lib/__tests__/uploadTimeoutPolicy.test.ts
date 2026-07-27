import { describe, it, expect } from 'vitest';
import { decideUploadTimeout } from '@/lib/uploadTimeoutPolicy';

/**
 * Auditoria 2026-07-26 (caso Alberto, Android, JPEG 4,8MB): o timeout de upload
 * recarregava a página INCONDICIONALMENTE — upload lento matava o File e a
 * bolha de retry ("a tela piscou"). A política agora exige evidência da sonda.
 */
describe('decideUploadTimeout', () => {
  it("sessão VÁLIDA = upload só está lento → NUNCA recarrega (retry fica vivo)", () => {
    const d = decideUploadTimeout('valid');
    expect(d.recoverStuck).toBe(false);
    expect(d.clearDead).toBe(false);
    expect(d.errorMessage).toMatch(/lenta/i);
    // humanizeSendError precisa cair no ramo de timeout (mensagem acionável)
    expect(d.errorMessage).toMatch(/timeout/i);
  });

  it("sonda pendurada ('unknown') = client zumbi comprovado → recoverStuckSession", () => {
    const d = decideUploadTimeout('unknown');
    expect(d.recoverStuck).toBe(true);
    expect(d.clearDead).toBe(false);
  });

  it("sessão MORTA → clearDeadSession (redirect declarativo, sem reload)", () => {
    const d = decideUploadTimeout('dead');
    expect(d.recoverStuck).toBe(false);
    expect(d.clearDead).toBe(true);
    // humanizeSendError traduz "sessão expirada" pra mensagem de login
    expect(d.errorMessage).toMatch(/sessão expirada/i);
  });
});
