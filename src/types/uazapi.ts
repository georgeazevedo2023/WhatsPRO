// ── Raw UAZAPI API shapes ────────────────────────────────────────────
// The UAZAPI provider returns fields in inconsistent casing (PascalCase
// and camelCase). These interfaces map every known variant so consumers
// can safely destructure without runtime errors.

/** Raw participant as returned by UAZAPI (camelCase + PascalCase). */
export interface RawUazapiParticipant {
  JID?: string;
  jid?: string;
  id?: string;
  PushName?: string;
  pushName?: string;
  DisplayName?: string;
  displayName?: string;
  Name?: string;
  name?: string;
  PhoneNumber?: string;
  phoneNumber?: string;
  IsAdmin?: boolean;
  isAdmin?: boolean;
  IsSuperAdmin?: boolean;
  isSuperAdmin?: boolean;
}

/** Raw group as returned by UAZAPI (camelCase + PascalCase). */
export interface RawUazapiGroup {
  JID?: string;
  jid?: string;
  id?: string;
  Name?: string;
  name?: string;
  Subject?: string;
  subject?: string;
  Topic?: string;
  Size?: number;
  size?: number;
  ParticipantCount?: number;
  profilePicUrl?: string;
  pictureUrl?: string;
  PictureUrl?: string;
  Participants?: RawUazapiParticipant[];
  participants?: RawUazapiParticipant[];
}

/** Raw instance as returned by the UAZAPI list endpoint. */
export interface UazapiInstance {
  id: string;
  instanceName: string;
  token: string;
  connectionStatus: string;
  ownerJid?: string;
  profilePicUrl?: string;
  profileName?: string;
}

// ── Helper extractors ────────────────────────────────────────────────

/** Normalize a raw UAZAPI response into an array of groups. */
export function extractGroupsArray(data: unknown): RawUazapiGroup[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.groups)) return obj.groups;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}
