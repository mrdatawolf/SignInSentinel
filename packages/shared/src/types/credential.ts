export interface Credential {
  id: number;
  clientId: number;
  email: string;
  tenantId: string | null;
  clientAppId: string | null;
  hasPassword: boolean;
  hasClientSecret: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCredentialRow {
  client: string;
  email: string;
  password: string;
}

export interface GraphConfig {
  tenantId: string;
  clientAppId: string;
  clientSecret: string;
}
