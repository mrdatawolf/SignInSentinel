export interface Client {
  id: number;
  abbreviation: string;
  name: string | null;
  group: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface ClientAbbreviation {
  abbreviation: string;
  name?: string;
  group: string;
}
