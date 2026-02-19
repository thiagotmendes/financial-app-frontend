const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const problem = await response.json();
      detail = problem?.detail ?? detail;
    } catch {
      // Ignore parsing errors and use status text.
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

export type Workspace = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  workspaceId: string;
  name: string;
};

export type Transaction = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amountCents: number;
  date: string;
  description: string | null;
  categoryId: string | null;
  paymentMethod: string;
};

export type Summary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

export type CreditCard = {
  id: string;
  workspaceId: string;
  name: string;
  closingDay: number;
  dueDay: number;
};

export type Purchase = {
  id: string;
  amountTotalCents: number;
  installments: number;
  purchaseDate: string;
  description: string | null;
  categoryId: string | null;
};

export type ProjectionItem = {
  referenceMonth: string;
  totalCents: number;
};

export type InvoicePreview = {
  totalCents: number;
  items: Array<{
    installmentId: string;
    purchaseId: string;
    installmentNumber: number;
    amountCents: number;
    status: string;
    description: string | null;
    categoryId: string | null;
  }>;
};

export type PaginatedTransactions = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
};

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, deviceName: 'frontend-web' }),
    });
  },
  getWorkspaces(token: string) {
    return request<Workspace[]>('/workspaces', {}, token);
  },
  getCategories(workspaceId: string, token: string) {
    return request<Category[]>(`/categories?workspaceId=${workspaceId}`, {}, token);
  },
  getTransactions(workspaceId: string, token: string) {
    return request<PaginatedTransactions>(
      `/transactions?workspaceId=${workspaceId}&page=1&pageSize=20`,
      {},
      token,
    );
  },
  createTransaction(
    payload: {
      workspaceId: string;
      type: 'INCOME' | 'EXPENSE';
      amountCents: number;
      currency?: string;
      date: string;
      description?: string;
      categoryId?: string;
      paymentMethod:
        | 'CASH'
        | 'PIX'
        | 'DEBIT'
        | 'CREDIT_CARD'
        | 'TRANSFER'
        | 'OTHER';
    },
    token: string,
  ) {
    return request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  getSummary(workspaceId: string, year: number, month: number, token: string) {
    return request<Summary>(
      `/transactions/summary?workspaceId=${workspaceId}&year=${year}&month=${month}`,
      {},
      token,
    );
  },
  getCards(workspaceId: string, token: string) {
    return request<CreditCard[]>(`/credit-cards?workspaceId=${workspaceId}`, {}, token);
  },
  createCard(
    payload: { workspaceId: string; name: string; closingDay: number; dueDay: number },
    token: string,
  ) {
    return request<CreditCard>('/credit-cards', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  getPurchases(cardId: string, token: string) {
    return request<Purchase[]>(`/credit-cards/${cardId}/purchases`, {}, token);
  },
  createPurchase(
    cardId: string,
    payload: {
      amountTotalCents: number;
      installments: number;
      purchaseDate: string;
      description?: string;
      categoryId?: string;
    },
    token: string,
  ) {
    return request<Purchase>(`/credit-cards/${cardId}/purchases`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, token);
  },
  getProjection(cardId: string, months: number, token: string) {
    return request<ProjectionItem[]>(
      `/credit-cards/${cardId}/projection?months=${months}`,
      {},
      token,
    );
  },
  getInvoice(cardId: string, year: number, month: number, token: string) {
    return request<InvoicePreview>(
      `/credit-cards/${cardId}/invoices/${year}/${month}`,
      {},
      token,
    );
  },
};
