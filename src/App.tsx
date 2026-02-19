import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  Category,
  CreditCard,
  InvoicePreview,
  ProjectionItem,
  Purchase,
  Summary,
  Transaction,
  Workspace,
  api,
} from './lib/api';
import { Panel } from './components/Panel';
import { ArrowRightLeft, CreditCardIcon, Home, LogOut, Wallet } from 'lucide-react';

const PAYMENT_METHODS = ['CASH', 'PIX', 'DEBIT', 'TRANSFER', 'OTHER'] as const;
const TRANSACTION_TYPES = ['INCOME', 'EXPENSE'] as const;
const PAGES = ['dashboard', 'transactions', 'cards'] as const;

type Page = (typeof PAGES)[number];

type TransactionForm = {
  type: (typeof TRANSACTION_TYPES)[number];
  amountCents: string;
  date: string;
  description: string;
  categoryId: string;
  paymentMethod: (typeof PAYMENT_METHODS)[number];
};

type CardForm = {
  name: string;
  closingDay: string;
  dueDay: string;
};

type PurchaseForm = {
  amountTotalCents: string;
  installments: string;
  purchaseDate: string;
  description: string;
  categoryId: string;
};

function currency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function toDateInput(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function pageLabel(page: Page) {
  if (page === 'dashboard') return 'Dashboard';
  if (page === 'transactions') return 'Cash Movements';
  return 'Credit Cards';
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('financial_app_token') ?? '');
  const [loginEmail, setLoginEmail] = useState('demo@financial.app');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [authLoading, setAuthLoading] = useState(false);

  const [page, setPage] = useState<Page>('dashboard');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [activeCardId, setActiveCardId] = useState('');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [projection, setProjection] = useState<ProjectionItem[]>([]);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);

  const [txForm, setTxForm] = useState<TransactionForm>({
    type: 'EXPENSE',
    amountCents: '',
    date: toDateInput(),
    description: '',
    categoryId: '',
    paymentMethod: 'PIX',
  });

  const [cardForm, setCardForm] = useState<CardForm>({
    name: '',
    closingDay: '20',
    dueDay: '28',
  });

  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>({
    amountTotalCents: '',
    installments: '6',
    purchaseDate: toDateInput(),
    description: '',
    categoryId: '',
  });
  const [purchaseCardId, setPurchaseCardId] = useState('');

  const [invoiceMonth, setInvoiceMonth] = useState(String(new Date().getMonth() + 1));
  const [invoiceYear, setInvoiceYear] = useState(String(new Date().getFullYear()));

  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  const activeCard = useMemo(
    () => cards.find((card) => card.id === activeCardId) ?? null,
    [cards, activeCardId],
  );

  const login = async () => {
    setError('');
    setAuthLoading(true);
    try {
      const response = await api.login(loginEmail, loginPassword);
      localStorage.setItem('financial_app_token', response.accessToken);
      setToken(response.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to login');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('financial_app_token');
    setToken('');
    setWorkspaces([]);
    setActiveWorkspaceId('');
    setCategories([]);
    setTransactions([]);
    setSummary(null);
    setCards([]);
    setActiveCardId('');
    setPurchaseCardId('');
    setPurchases([]);
    setProjection([]);
    setInvoice(null);
    setPage('dashboard');
  };

  const bootWorkspace = async (workspaceId: string, authToken = token) => {
    if (!workspaceId || !authToken) return;

    setLoadingData(true);
    setError('');

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const [categoriesRes, transactionsRes, summaryRes, cardsRes] = await Promise.all([
        api.getCategories(workspaceId, authToken),
        api.getTransactions(workspaceId, authToken),
        api.getSummary(workspaceId, year, month, authToken),
        api.getCards(workspaceId, authToken),
      ]);

      setCategories(categoriesRes);
      setTransactions(transactionsRes.items);
      setSummary(summaryRes);
      setCards(cardsRes);

      setActiveCardId((current) => {
        if (!cardsRes.length) return '';
        if (current && cardsRes.some((card) => card.id === current)) return current;
        return '';
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Unable to load workspace data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadCardAnalytics = async (cardId: string, authToken = token) => {
    if (!authToken) {
      setPurchases([]);
      setProjection([]);
      setInvoice(null);
      return;
    }

    try {
      const [purchasesRes, projectionRes] = await Promise.all([
        api.getPurchases(cardId, authToken),
        api.getProjection(cardId, 12, authToken),
      ]);
      setPurchases(purchasesRes);
      setProjection(projectionRes);
      setInvoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load card analytics');
    }
  };

  const loadAllCardsAnalytics = async (authToken = token) => {
    if (!authToken) {
      setPurchases([]);
      setProjection([]);
      setInvoice(null);
      return;
    }

    if (!cards.length) {
      setPurchases([]);
      setProjection([]);
      setInvoice(null);
      return;
    }

    try {
      const [allPurchases, allProjections] = await Promise.all([
        Promise.all(cards.map((card) => api.getPurchases(card.id, authToken))),
        Promise.all(cards.map((card) => api.getProjection(card.id, 12, authToken))),
      ]);

      const mergedPurchases = allPurchases
        .flat()
        .sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
      const projectionMap = new Map<string, number>();

      for (const projectionItems of allProjections) {
        for (const item of projectionItems) {
          projectionMap.set(item.referenceMonth, (projectionMap.get(item.referenceMonth) ?? 0) + item.totalCents);
        }
      }

      const mergedProjection = Array.from(projectionMap.entries())
        .map(([referenceMonth, totalCents]) => ({ referenceMonth, totalCents }))
        .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));

      setPurchases(mergedPurchases);
      setProjection(mergedProjection);
      setInvoice(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load cards overview');
    }
  };

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    (async () => {
      setLoadingData(true);
      setError('');
      try {
        const ws = await api.getWorkspaces(token);
        if (cancelled) return;

        setWorkspaces(ws);
        setActiveWorkspaceId(ws[0]?.id ?? '');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Unable to load workspaces');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!activeWorkspaceId || !token) return;
    bootWorkspace(activeWorkspaceId);
  }, [activeWorkspaceId, token]);

  useEffect(() => {
    if (!token) {
      setPurchases([]);
      setProjection([]);
      setInvoice(null);
      return;
    }

    if (!activeCardId) {
      loadAllCardsAnalytics(token);
      return;
    }

    loadCardAnalytics(activeCardId, token);
  }, [activeCardId, token, cards]);

  useEffect(() => {
    if (!cards.length) {
      setPurchaseCardId('');
      return;
    }

    if (activeCardId && cards.some((card) => card.id === activeCardId)) {
      setPurchaseCardId(activeCardId);
      return;
    }

    setPurchaseCardId((current) =>
      current && cards.some((card) => card.id === current) ? current : cards[0].id,
    );
  }, [cards, activeCardId]);

  const submitTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspaceId) return;

    try {
      await api.createTransaction(
        {
          workspaceId: activeWorkspaceId,
          type: txForm.type,
          amountCents: Number(txForm.amountCents),
          date: new Date(txForm.date).toISOString(),
          description: txForm.description || undefined,
          categoryId: txForm.categoryId || undefined,
          paymentMethod: txForm.paymentMethod,
        },
        token,
      );

      setTxForm((prev) => ({ ...prev, amountCents: '', description: '' }));
      await bootWorkspace(activeWorkspaceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create movement');
    }
  };

  const submitCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeWorkspaceId) return;

    try {
      await api.createCard(
        {
          workspaceId: activeWorkspaceId,
          name: cardForm.name,
          closingDay: Number(cardForm.closingDay),
          dueDay: Number(cardForm.dueDay),
        },
        token,
      );

      setCardForm({ name: '', closingDay: '20', dueDay: '28' });
      await bootWorkspace(activeWorkspaceId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create card');
    }
  };

  const submitPurchase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetCardId = purchaseCardId || activeCardId;
    if (!targetCardId) {
      setError('Select a card to add a credit-card expense');
      return;
    }

    try {
      await api.createPurchase(
        targetCardId,
        {
          amountTotalCents: Number(purchaseForm.amountTotalCents),
          installments: Number(purchaseForm.installments),
          purchaseDate: new Date(purchaseForm.purchaseDate).toISOString(),
          description: purchaseForm.description || undefined,
          categoryId: purchaseForm.categoryId || undefined,
        },
        token,
      );

      setPurchaseForm((prev) => ({ ...prev, amountTotalCents: '', description: '' }));
      if (activeCardId) {
        await loadCardAnalytics(activeCardId);
      } else {
        await loadAllCardsAnalytics();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create purchase');
    }
  };

  const fetchInvoice = async () => {
    if (!cards.length) return;

    try {
      if (activeCardId) {
        const response = await api.getInvoice(
          activeCardId,
          Number(invoiceYear),
          Number(invoiceMonth),
          token,
        );
        setInvoice(response);
        return;
      }

      const allInvoices = await Promise.all(
        cards.map((card) => api.getInvoice(card.id, Number(invoiceYear), Number(invoiceMonth), token)),
      );

      const merged: InvoicePreview = {
        totalCents: allInvoices.reduce((sum, current) => sum + current.totalCents, 0),
        items: allInvoices.flatMap((current) => current.items),
      };
      setInvoice(merged);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load invoice');
    }
  };

  const renderDashboard = () => (
    <>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <div className="mb-2 inline-flex rounded-full bg-sky/10 p-2 text-sky">
            <Wallet size={16} />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Income</p>
          <p className="font-title text-2xl font-bold text-ink">{currency(summary?.incomeCents ?? 0)}</p>
        </div>

        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <div className="mb-2 inline-flex rounded-full bg-peach/10 p-2 text-peach">
            <ArrowRightLeft size={16} />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Expenses</p>
          <p className="font-title text-2xl font-bold text-ink">{currency(summary?.expenseCents ?? 0)}</p>
        </div>

        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <div className="mb-2 inline-flex rounded-full bg-mint/10 p-2 text-mint">
            <CreditCardIcon size={16} />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Balance</p>
          <p className="font-title text-2xl font-bold text-ink">{currency(summary?.balanceCents ?? 0)}</p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Workspaces</p>
          <p className="font-title text-2xl font-bold text-ink">{workspaces.length}</p>
        </div>
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Categories</p>
          <p className="font-title text-2xl font-bold text-ink">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Movements</p>
          <p className="font-title text-2xl font-bold text-ink">{transactions.length}</p>
        </div>
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Cards</p>
          <p className="font-title text-2xl font-bold text-ink">{cards.length}</p>
        </div>
        <div className="rounded-xl border border-white/30 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Purchases</p>
          <p className="font-title text-2xl font-bold text-ink">{purchases.length}</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel title="Latest Cash Movements">
          <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
            {transactions.slice(0, 8).map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-ink">{transaction.type}</p>
                  <p className="font-semibold text-ink">{currency(transaction.amountCents)}</p>
                </div>
                <p className="text-xs text-slate-500">{transaction.date.slice(0, 10)}</p>
                <p className="mt-1 text-slate-700">{transaction.description ?? 'No description'}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Card Projection Snapshot"
          right={
            <span className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
              {activeCard?.name ?? 'All cards'}
            </span>
          }
        >
          {projection.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {projection.slice(0, 6).map((item) => (
                <div key={item.referenceMonth} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.referenceMonth}</p>
                  <p className="font-semibold text-ink">{currency(item.totalCents)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Create a card and purchases to view future projection.</p>
          )}
        </Panel>
      </section>
    </>
  );

  const renderTransactionsPage = () => (
    <section className="grid gap-5 lg:grid-cols-2">
      <Panel title="Cash Account Movement">
        <p className="mb-3 text-xs text-slate-500">
          Use this for cash, PIX, debit and transfer movements. Credit-card purchases live in the
          Credit Cards page.
        </p>

        <form className="grid gap-3" onSubmit={submitTransaction}>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={txForm.type}
              onChange={(event) =>
                setTxForm((prev) => ({ ...prev, type: event.target.value as TransactionForm['type'] }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <input
              placeholder="Amount in cents"
              value={txForm.amountCents}
              onChange={(event) => setTxForm((prev) => ({ ...prev, amountCents: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="date"
              value={txForm.date}
              onChange={(event) => setTxForm((prev) => ({ ...prev, date: event.target.value }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />

            <select
              value={txForm.paymentMethod}
              onChange={(event) =>
                setTxForm((prev) => ({
                  ...prev,
                  paymentMethod: event.target.value as TransactionForm['paymentMethod'],
                }))
              }
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <select
            value={txForm.categoryId}
            onChange={(event) => setTxForm((prev) => ({ ...prev, categoryId: event.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <input
            placeholder="Description"
            value={txForm.description}
            onChange={(event) => setTxForm((prev) => ({ ...prev, description: event.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />

          <button className="rounded-lg bg-ink px-3 py-2 font-semibold text-white hover:bg-slate-700">
            Save movement
          </button>
        </form>
      </Panel>

      <Panel title="Latest Movements">
        <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{transaction.type}</p>
                <p className="font-semibold text-ink">{currency(transaction.amountCents)}</p>
              </div>
              <p className="text-xs text-slate-500">{transaction.date.slice(0, 10)}</p>
              <p className="mt-1 text-slate-700">{transaction.description ?? 'No description'}</p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );

  const renderCardsPage = () => (
    <>
      <section className="mb-5 rounded-2xl border border-white/25 bg-white/75 p-4 shadow-glow backdrop-blur-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Card Scope</p>
            <p className="text-sm text-slate-700">
              {activeCard
                ? `Viewing ${activeCard.name} • closing day ${activeCard.closingDay}, due day ${activeCard.dueDay}`
                : cards.length
                  ? 'Viewing consolidated overview for all cards'
                  : 'Create a card to start your credit-card overview'}
            </p>
          </div>

          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm md:w-72"
            value={activeCardId}
            onChange={(event) => setActiveCardId(event.target.value)}
          >
            <option value="">All cards</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <Panel title="Create Credit Card">
            <form className="grid gap-3" onSubmit={submitCard}>
              <input
                placeholder="Card name"
                value={cardForm.name}
                onChange={(event) => setCardForm((prev) => ({ ...prev, name: event.target.value }))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  placeholder="Closing day"
                  value={cardForm.closingDay}
                  onChange={(event) => setCardForm((prev) => ({ ...prev, closingDay: event.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
                <input
                  placeholder="Due day"
                  value={cardForm.dueDay}
                  onChange={(event) => setCardForm((prev) => ({ ...prev, dueDay: event.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                />
              </div>
              <button className="rounded-lg bg-ink px-3 py-2 font-semibold text-white hover:bg-slate-700">
                Save card
              </button>
            </form>
          </Panel>
        </div>

        <div className="grid gap-5">
          <Panel title="Credit Card Expenses">
            <>
              {cards.length ? (
                <form className="mb-4 grid gap-3" onSubmit={submitPurchase}>
                  <select
                    value={purchaseCardId}
                    onChange={(event) => setPurchaseCardId(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="">Select card for this expense</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      placeholder="Amount in cents"
                      value={purchaseForm.amountTotalCents}
                      onChange={(event) =>
                        setPurchaseForm((prev) => ({ ...prev, amountTotalCents: event.target.value }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                    <input
                      placeholder="Installments"
                      value={purchaseForm.installments}
                      onChange={(event) =>
                        setPurchaseForm((prev) => ({ ...prev, installments: event.target.value }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="date"
                      value={purchaseForm.purchaseDate}
                      onChange={(event) =>
                        setPurchaseForm((prev) => ({ ...prev, purchaseDate: event.target.value }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />

                    <select
                      value={purchaseForm.categoryId}
                      onChange={(event) =>
                        setPurchaseForm((prev) => ({ ...prev, categoryId: event.target.value }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    placeholder="Description"
                    value={purchaseForm.description}
                    onChange={(event) =>
                      setPurchaseForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                  />

                  <button className="rounded-lg bg-ink px-3 py-2 font-semibold text-white hover:bg-slate-700">
                    Save purchase
                  </button>
                </form>
              ) : (
                <p className="mb-4 text-sm text-slate-500">
                  Create at least one card first. Then you can add credit-card expenses here.
                </p>
              )}

              <div className="mb-4 grid gap-2 md:grid-cols-3">
                {projection.map((item) => (
                  <div key={item.referenceMonth} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.referenceMonth}</p>
                  <p className="font-semibold text-ink">{currency(item.totalCents)}</p>
                </div>
              ))}
              </div>

              <div className="mb-3 rounded-lg border border-sky/30 bg-sky/5 px-3 py-2 text-xs text-slate-700">
                Invoice Preview is read-only. It does not create expenses automatically.
              </div>

              <div className="mb-3 flex flex-wrap items-end gap-2">
                <input
                  value={invoiceYear}
                  onChange={(event) => setInvoiceYear(event.target.value)}
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="Year"
                />
                <input
                  value={invoiceMonth}
                  onChange={(event) => setInvoiceMonth(event.target.value)}
                  className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="Month"
                />
                <button
                  onClick={fetchInvoice}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
                >
                  Load invoice {activeCardId ? '' : '(all cards)'}
                </button>
              </div>

              {invoice ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p className="font-semibold text-ink">Invoice total: {currency(invoice.totalCents)}</p>
                  <p className="text-xs text-slate-500">Items: {invoice.items.length}</p>
                </div>
              ) : null}

              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-ink">{currency(purchase.amountTotalCents)}</p>
                      <p className="text-xs text-slate-500">{purchase.installments}x</p>
                    </div>
                    <p className="text-xs text-slate-500">{purchase.purchaseDate.slice(0, 10)}</p>
                    <p className="mt-1 text-slate-700">{purchase.description ?? 'No description'}</p>
                  </div>
                ))}
              </div>
            </>
          </Panel>
        </div>
      </section>
    </>
  );

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
        <section className="w-full max-w-xl rounded-3xl border border-white/30 bg-white/75 p-8 shadow-glow backdrop-blur-md">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-sky">Financial App</p>
          <h1 className="font-title text-4xl font-bold text-ink">Backend Test Console</h1>
          <p className="mt-3 text-sm text-storm/80">
            Login with seeded users to test auth, workspaces, cash movements and credit cards.
          </p>

          <div className="mt-8 grid gap-4">
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none ring-sky/50 transition focus:ring"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="Email"
            />
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none ring-sky/50 transition focus:ring"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Password"
            />
            <button
              className="rounded-xl bg-ink px-4 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              onClick={login}
              disabled={authLoading}
            >
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-5 md:p-8">
      <header className="mb-6 rounded-2xl border border-white/25 bg-white/75 p-4 shadow-glow backdrop-blur-md">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">React + Tailwind + Vite</p>
            <h1 className="font-title text-3xl font-bold text-ink">Finance Frontend</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              value={activeWorkspaceId}
              onChange={(event) => setActiveWorkspaceId(event.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100"
              onClick={() => activeWorkspaceId && bootWorkspace(activeWorkspaceId)}
            >
              Refresh
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-sm text-white hover:bg-slate-700"
              onClick={logout}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              page === 'dashboard' ? 'bg-ink text-white' : 'border border-slate-300 bg-white hover:bg-slate-100'
            }`}
            onClick={() => setPage('dashboard')}
          >
            <Home size={16} />
            Dashboard
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              page === 'transactions'
                ? 'bg-ink text-white'
                : 'border border-slate-300 bg-white hover:bg-slate-100'
            }`}
            onClick={() => setPage('transactions')}
          >
            <ArrowRightLeft size={16} />
            Cash Movements
          </button>
          <button
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              page === 'cards' ? 'bg-ink text-white' : 'border border-slate-300 bg-white hover:bg-slate-100'
            }`}
            onClick={() => setPage('cards')}
          >
            <CreditCardIcon size={16} />
            Credit Cards
          </button>
        </nav>
      </header>

      <section className="mb-5 rounded-xl border border-white/25 bg-white/60 px-4 py-2 text-sm text-slate-700">
        Active page: <span className="font-semibold text-ink">{pageLabel(page)}</span>
      </section>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loadingData ? (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading data...
        </div>
      ) : null}

      {page === 'dashboard' ? renderDashboard() : null}
      {page === 'transactions' ? renderTransactionsPage() : null}
      {page === 'cards' ? renderCardsPage() : null}
    </main>
  );
}
