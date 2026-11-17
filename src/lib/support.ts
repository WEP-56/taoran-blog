export interface SupportChannel {
  id: string;
  name: string;
  url: string;
  qrUrl: string;
  description: string;
}

export interface Supporter {
  id: string;
  name: string;
  url: string;
  date: string;
  amount: string;
  message: string;
}

export interface SupportContent {
  reason: string;
  declaration: string;
  thanks: string;
  channels: SupportChannel[];
  supporters: Supporter[];
}

export interface SupportSettings extends SupportContent { revision: number }

export const emptySupport: SupportContent = {
  reason: "", declaration: "", thanks: "", channels: [], supporters: [],
};
