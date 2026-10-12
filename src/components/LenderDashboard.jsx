import { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../AppContext.jsx';
import { addDoc, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import BadgeLegend from './BadgeLegend.jsx';
import UnpaidCustomerDirectory from './UnpaidCustomerDirectory.jsx';
import { calculateLoanTotals, formatPaymentTimeframe, getDateAfterDays } from '../loanUtils.js';

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

const riskDetails = {
  GREEN: {
    label: 'Good Standing',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    dotClassName: 'bg-emerald-600',
  },
  YELLOW: {
    label: 'Warning: Near Limit',
    className: 'border-amber-200 bg-amber-50 text-amber-950',
    dotClassName: 'bg-amber-500',
  },
  RED: {
    label: 'Credit Blocked: Unpaid Overdue Debt',
    className: 'border-red-200 bg-red-50 text-red-900',
    dotClassName: 'bg-red-600',
  },
};

function formatTransactionAmount(amount) {
  return `${amount < 0 ? '\u2212' : '+'}${peso.format(Math.abs(amount))}`;
}

function getCreatedAtMilliseconds(value) {
  if (value?.toMillis) return value.toMillis();
  const parsedDate = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

function formatCreatedAt(value) {
  const milliseconds = getCreatedAtMilliseconds(value);
  return milliseconds ? new Date(milliseconds).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
}

function getLoanTotal(loan) {
  return Number(loan.totalDue ?? calculateLoanTotals(Number(loan.principal) || 0, Number(loan.interestRate) || 0).totalDue);
}

function getOutstandingBalance(loan) {
  return Math.max(getLoanTotal(loan) - (Number(loan.amountPaid) || 0), 0);
}

export default function LenderDashboard() {
  const { loans, loansLoading, loansError, userData } = useAppContext();
  const [borrowers, setBorrowers] = useState([]);
  const [pendingBorrowers, setPendingBorrowers] = useState([]);
  const [borrowersLoading, setBorrowersLoading] = useState(true);
  const [approvalLoading, setApprovalLoading] = useState(true);
  const [borrowersError, setBorrowersError] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [approvingUserId, setApprovingUserId] = useState('');
  const [approvalNotice, setApprovalNotice] = useState('');
  const [activeTab, setActiveTab] = useState('credit');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [lateFee, setLateFee] = useState('');
  const [interestRate, setInterestRate] = useState('5');
  const [dueDays, setDueDays] = useState('7');
  const [description, setDescription] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [offerSubmitted, setOfferSubmitted] = useState(false);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [verificationQueueError, setVerificationQueueError] = useState('');
  const [isSavingOffer, setIsSavingOffer] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [verifyingLoanId, setVerifyingLoanId] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentCustomerId, setPaymentCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentChannel, setPaymentChannel] = useState('Cash');
  const [paymentConfirmation, setPaymentConfirmation] = useState('');
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    const approvedQuery = query(collection(db, 'users'), where('status', '==', 'approved'));
    return onSnapshot(approvedQuery, (snapshot) => {
      setBorrowers(snapshot.docs
        .map((userDocument) => ({ ...userDocument.data(), id: userDocument.id }))
        .filter((borrower) => (borrower.role || 'borrower') === 'borrower'));
      setBorrowersLoading(false);
      setBorrowersError('');
    }, (error) => {
      setBorrowersError(error.message || 'Unable to load approved borrower accounts.');
      setBorrowersLoading(false);
    });
  }, []);

  useEffect(() => {
    const pendingQuery = query(collection(db, 'users'), where('status', '==', 'pending'));
    return onSnapshot(pendingQuery, (snapshot) => {
      setPendingBorrowers(snapshot.docs
        .map((userDocument) => ({ ...userDocument.data(), id: userDocument.id })));
      setApprovalLoading(false);
      setApprovalError('');
    }, (error) => {
      setApprovalError(error.message || 'Unable to load pending borrower approvals.');
      setApprovalLoading(false);
    });
  }, []);

  useEffect(() => {
    const verificationQuery = query(collection(db, 'loans'), where('status', '==', 'pending_verification'));
    return onSnapshot(verificationQuery, (snapshot) => {
      const queue = snapshot.docs
        .map((loanDoc) => ({ ...loanDoc.data(), id: loanDoc.id }))
        .sort((first, second) => getCreatedAtMilliseconds(second.createdAt) - getCreatedAtMilliseconds(first.createdAt));
      setVerificationQueue(queue);
      setVerificationQueueError('');
    }, (error) => {
      setVerificationQueueError(error.message || 'Unable to load payment verification items.');
    });
  }, []);

  const customers = useMemo(() => {
    return borrowers.map((borrower) => {
      const borrowerLoans = loans
        .filter((loan) => loan.borrowerId === borrower.id || (borrower.email && loan.borrowerEmail === borrower.email))
        .sort((first, second) => getCreatedAtMilliseconds(first.createdAt) - getCreatedAtMilliseconds(second.createdAt));
      const transactions = borrowerLoans.map((loan) => ({
        id: loan.id,
        description: 'Credit offer',
        date: formatCreatedAt(loan.createdAt),
        amount: Number(loan.principal) || 0,
      }));
      const outstandingHistory = borrowerLoans.map((loan) => ({
        id: loan.id,
        date: formatCreatedAt(loan.createdAt),
        originalAmount: Number(loan.principal) || 0,
        outstandingAmount: getOutstandingBalance(loan),
      }));
      const latestLoan = borrowerLoans.at(-1);

      return {
        ...borrower,
        phone: borrower.phoneNumber || '',
        riskStatus: borrower.riskStatus || 'GREEN',
        creditLimit: Number(borrower.creditLimit) || 500,
        creditUsed: borrowerLoans.reduce((total, loan) => total + Math.max((Number(loan.principal) || 0) - (Number(loan.principalPaid) || 0), 0), 0),
        outstandingBalance: borrowerLoans.reduce((total, loan) => total + getOutstandingBalance(loan), 0),
        loans: borrowerLoans,
        transactions,
        outstandingHistory,
        latestTransactionDate: latestLoan ? formatCreatedAt(latestLoan.createdAt) : 'No loan history',
        latestTransactionTimestamp: getCreatedAtMilliseconds(latestLoan?.createdAt),
      };
    });
  }, [borrowers, loans]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const paymentCustomer = customers.find((customer) => customer.id === paymentCustomerId) ?? null;

  const matchingCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return [];
    return customers.filter((customer) =>
      `${customer.name} ${customer.id} ${customer.email}`.toLowerCase().includes(normalizedSearch),
    );
  }, [customers, search]);

  const matchingPaymentCustomers = useMemo(() => {
    const normalizedSearch = paymentSearch.trim().toLowerCase();
    if (!normalizedSearch) return [];
    return customers.filter((customer) => customer.outstandingBalance > 0 &&
      `${customer.name} ${customer.id} ${customer.email}`.toLowerCase().includes(normalizedSearch),
    );
  }, [customers, paymentSearch]);

  const isBlocked = selectedCustomer?.riskStatus === 'RED';
  const activeLoan = selectedCustomer?.loans.find((loan) => loan.status === 'active') ?? selectedCustomer?.loans[0] ?? null;
  const activeLoanPrincipal = activeLoan?.principal ?? 0;
  const activeLoanRate = activeLoan?.interestRate ?? 0;
  const activeLoanTotals = calculateLoanTotals(activeLoanPrincipal, activeLoanRate);
  const offerPrincipal = Number(principal) || 0;
  const offerTotals = calculateLoanTotals(offerPrincipal, Number(interestRate));
  const offerDueDate = getDateAfterDays(Number(dueDays));
  const selectedAvailableCredit = selectedCustomer
    ? Math.max(selectedCustomer.creditLimit - selectedCustomer.creditUsed, 0)
    : 0;

  async function approveBorrower(borrower) {
    setApprovingUserId(borrower.id);
    setApprovalError('');
    setApprovalNotice('');
    try {
      await updateDoc(doc(db, 'users', borrower.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
      setApprovalNotice(`${borrower.name || borrower.email} approved successfully.`);
    } catch (error) {
      setApprovalError(error.message || 'Unable to approve this borrower. Please try again.');
    } finally {
      setApprovingUserId('');
    }
  }

  function selectCustomer(customer) {
    setSelectedCustomerId(customer.id);
    setSearch(customer.name);
    setPrincipal('');
    setLateFee('');
    setInterestRate('5');
    setDueDays('7');
    setDescription('');
    setConfirmation('');
    setFormError('');
    setOfferSubmitted(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedCustomer || isBlocked || offerSubmitted || isSavingOffer) return;
    const principalAmount = Number(principal);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0 || principalAmount > selectedAvailableCredit) {
      setFormError(`Enter a principal amount between ₱1.00 and ${peso.format(selectedAvailableCredit)}.`);
      return;
    }

    const offerDueDate = getDateAfterDays(Number(dueDays));
    const submittedTotals = calculateLoanTotals(principalAmount, Number(interestRate));
    setFormError('');
    setConfirmation('');
    setIsSavingOffer(true);

    try {
      await addDoc(collection(db, 'loans'), {
        principal: principalAmount,
        interestRate: Number(interestRate),
        interest: submittedTotals.interest,
        totalDue: submittedTotals.totalDue,
        timeframeDays: Number(dueDays),
        dueDate: offerDueDate,
        borrowerId: selectedCustomer.id,
        borrowerName: selectedCustomer.name,
        borrowerEmail: selectedCustomer.email,
        lenderName: userData?.name || 'CrediTrack Lender',
        lenderId: userData?.id || 'unknown-lender',
        description: description.trim() || 'No description provided',
        borrowerCreditLimit: selectedCustomer.creditLimit,
        amountPaid: 0,
        principalPaid: 0,
        lateFee: Number(lateFee),
        status: 'active',
        createdAt: serverTimestamp(),
      });
      setOfferSubmitted(true);
      setConfirmation('Credit offer submitted successfully.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this credit offer. Please try again.');
    } finally {
      setIsSavingOffer(false);
    }
  }

  function selectPaymentCustomer(customer) {
    setPaymentCustomerId(customer.id);
    setPaymentSearch(customer.name);
    setPaymentAmount('');
    setPaymentConfirmation('');
    setPaymentError('');
  }

  async function confirmPaymentVerification(loan) {
    setVerifyingLoanId(loan.id);
    setPaymentError('');
    setPaymentConfirmation('');
    try {
      await runTransaction(db, async (transaction) => {
        const loanRef = doc(db, 'loans', loan.id);
        const loanSnapshot = await transaction.get(loanRef);
        if (!loanSnapshot.exists() || loanSnapshot.data().status !== 'pending_verification') {
          throw new Error('This payment is no longer awaiting verification.');
        }
        const currentLoan = loanSnapshot.data();
        if (!currentLoan.paymentProofUrl) {
          throw new Error('This loan has no payment receipt to verify.');
        }
        transaction.update(loanRef, {
          status: 'paid',
          amountPaid: getLoanTotal(currentLoan),
          principalPaid: Number(currentLoan.principal) || 0,
          paidAt: serverTimestamp(),
          verifiedBy: userData?.id || null,
        });
      });
      setPaymentConfirmation(`Payment for ${loan.borrowerName || 'borrower'} confirmed and marked as paid.`);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to confirm this payment. Please try again.');
    } finally {
      setVerifyingLoanId('');
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!paymentCustomer || !Number.isFinite(amount) || amount <= 0 || amount > paymentCustomer.outstandingBalance) {
      setPaymentError(`Enter a payment between ₱0.01 and ${peso.format(paymentCustomer?.outstandingBalance ?? 0)}.`);
      return;
    }

    let remainingPayment = amount;
    const batch = writeBatch(db);
    const settledLoans = [];

    for (const loan of paymentCustomer.loans) {
      if (remainingPayment <= 0) break;
      const totalDue = getLoanTotal(loan);
      const amountPaid = Number(loan.amountPaid) || 0;
      const outstanding = Math.max(totalDue - amountPaid, 0);
      const settlement = Math.min(outstanding, remainingPayment);
      if (settlement <= 0) continue;

      remainingPayment -= settlement;
      const nextAmountPaid = amountPaid + settlement;
      const nextPrincipalPaid = Math.min(Number(loan.principal) || 0, (Number(loan.principalPaid) || 0) + settlement);
      const nextStatus = nextAmountPaid >= totalDue ? 'paid' : 'active';
      batch.update(doc(db, 'loans', loan.id), {
        amountPaid: nextAmountPaid,
        principalPaid: nextPrincipalPaid,
        status: nextStatus,
        latestPaymentAt: serverTimestamp(),
      });
      settledLoans.push({ loanId: loan.id, amount: settlement });
    }

    batch.set(doc(collection(db, 'payments')), {
      borrowerId: paymentCustomer.id,
      borrowerName: paymentCustomer.name,
      borrowerEmail: paymentCustomer.email,
      amount,
      channel: paymentChannel,
      settlements: settledLoans,
      createdAt: serverTimestamp(),
    });

    setIsRecordingPayment(true);
    setPaymentError('');
    setPaymentConfirmation('');
    try {
      await batch.commit();
      setPaymentConfirmation(`${peso.format(amount)} payment recorded for ${paymentCustomer.name}. FIFO settlement applied.`);
      setPaymentAmount('');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Unable to save this payment. Please try again.');
    } finally {
      setIsRecordingPayment(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-amber-800">Lender workspace</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {activeTab === 'credit' ? 'Credit sales' : activeTab === 'payment' ? 'Receive payment' : activeTab === 'directory' ? 'Unpaid customer directory' : 'Pending approvals'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {activeTab === 'credit' ? 'Search approved borrowers and prepare a credit offer.' : activeTab === 'payment' ? 'Record a payment and settle the oldest outstanding balance first.' : activeTab === 'directory' ? 'Review active customer balances and their latest activity.' : 'Review borrower registrations before they can access credit.'}
        </p>
      </div>

      <BadgeLegend className="mb-6" />
      {loansLoading && <p className="mb-5 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Loading loan records...</p>}
      {loansError && <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{loansError}</p>}
      {approvalError && <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">Pending approval query failed: {approvalError}</p>}

      <div role="tablist" aria-label="Lender modules" className="mb-6 flex overflow-x-auto border-b border-gray-200">
        {[
          { id: 'credit', label: 'Credit Sales' },
          { id: 'payment', label: 'Receive Payment' },
          { id: 'directory', label: 'Unpaid Customer Directory' },
          { id: 'approvals', label: 'Pending Approvals' },
        ].map((tab) => (
          <button
            key={tab.id}
            id={`${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'border-emerald-700 text-emerald-900' : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}
          >
            {tab.label}
            {tab.id === 'approvals' && pendingBorrowers.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">{pendingBorrowers.length}</span>
            )}
          </button>
        ))}
      </div>

      <div id="credit-panel" role="tabpanel" aria-labelledby="credit-tab" hidden={activeTab !== 'credit'}>
      {borrowersLoading && <p className="mb-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Loading approved borrower accounts...</p>}
      {borrowersError && <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{borrowersError}</p>}
      <section aria-labelledby="customer-search-heading" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
        <div className="max-w-2xl">
          <h2 id="customer-search-heading" className="text-lg font-semibold">Find a customer</h2>
          <label htmlFor="customer-search" className="mt-4 block text-sm font-medium text-gray-700">Customer search</label>
          <input
            id="customer-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={matchingCustomers.length > 0 && !selectedCustomer}
            aria-controls="customer-search-results"
            placeholder="Search approved borrowers by name, ID, or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedCustomerId('');
              setConfirmation('');
            }}
            className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
          />
          {matchingCustomers.length > 0 && !selectedCustomer && (
            <ul id="customer-search-results" role="listbox" className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
              {matchingCustomers.map((customer) => (
                <li key={customer.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    <span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{customer.name}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${riskDetails[customer.riskStatus].className}`}>
                          <span className={`size-1.5 rounded-full ${riskDetails[customer.riskStatus].dotClassName}`} aria-hidden="true" />
                          {riskDetails[customer.riskStatus].label}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{customer.id} · {customer.email}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {search.trim() && !matchingCustomers.length && !selectedCustomer && !borrowersLoading && (
            <p className="mt-2 text-sm text-gray-500">No approved borrower matches that search.</p>
          )}
        </div>
      </section>

      {selectedCustomer ? (
        <>
          <section aria-labelledby="customer-credit-heading" className="mt-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">Selected customer</p>
                <h2 id="customer-credit-heading" className="mt-1 text-xl font-semibold">{selectedCustomer.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedCustomer.id} · {selectedCustomer.phone}</p>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${riskDetails[selectedCustomer.riskStatus].className}`}>
                <span className={`size-2 rounded-full ${riskDetails[selectedCustomer.riskStatus].dotClassName}`} aria-hidden="true" />
                {riskDetails[selectedCustomer.riskStatus].label}
              </span>
            </div>
            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-sm text-gray-600">Available credit</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{peso.format(selectedAvailableCredit)}</p>
            </div>
          </section>

          <section aria-labelledby="active-loans-heading" className="mt-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="active-loans-heading" className="text-lg font-semibold">Active loans</h2>
                <p className="mt-1 text-sm text-gray-500">Loan {activeLoan?.id ?? `LN-${selectedCustomer.id.slice(-3)}`} · payment timeframe</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${activeLoan && new Date(`${activeLoan.dueDate}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)) ? 'bg-red-100 text-red-900' : 'bg-amber-100 text-amber-950'}`}>
                {formatPaymentTimeframe(activeLoan?.dueDate)}
              </span>
            </div>
            <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-gray-500">Principal</p>
                <p className="mt-1 font-semibold tabular-nums">{peso.format(activeLoanPrincipal)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Interest ({activeLoanRate}%)</p>
                <p className="mt-1 font-semibold tabular-nums">{peso.format(activeLoanTotals.interest)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total due</p>
                <p className="mt-1 font-semibold tabular-nums text-emerald-900">{peso.format(activeLoanTotals.totalDue)}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="customer-history-heading" className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
              <h2 id="customer-history-heading" className="text-lg font-semibold">Recent transaction history</h2>
            </div>
            <ul className="divide-y divide-gray-100">
              {selectedCustomer.transactions.length ? selectedCustomer.transactions.map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{transaction.description}</p>
                    <p className="mt-1 text-xs text-gray-500">{transaction.date} · {transaction.id}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.amount < 0 ? 'text-gray-800' : 'text-emerald-800'}`}>
                    {formatTransactionAmount(transaction.amount)}
                  </p>
                </li>
              )) : (
                <li className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">No recent transactions found.</li>
              )}
            </ul>
          </section>

          <section aria-labelledby="credit-input-heading" className="mt-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
            <div className="mb-5">
              <h2 id="credit-input-heading" className="text-lg font-semibold">Prepare credit offer</h2>
              <p className="mt-1 text-sm text-gray-500">Enter the credit terms for this customer.</p>
            </div>
            <form onSubmit={handleSubmit} onInvalid={() => setFormError('Complete all required credit offer fields before submitting.')}>
              <fieldset disabled={isBlocked || isSavingOffer || offerSubmitted} className="grid gap-4 disabled:opacity-50 sm:grid-cols-2">
                <legend className="sr-only">Credit offer terms</legend>
                <div>
                  <label htmlFor="principal-amount" className="block text-sm font-medium text-gray-700">Principal amount</label>
                  <div className="mt-2 flex min-h-11 rounded-md border border-gray-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20">
                    <span className="grid place-items-center border-r border-gray-200 px-3 text-sm text-gray-500" aria-hidden="true">₱</span>
                    <input id="principal-amount" type="number" min="1" max={selectedAvailableCredit} step="0.01" required value={principal} onChange={(event) => { setPrincipal(event.target.value); setOfferSubmitted(false); setConfirmation(''); setFormError(''); }} placeholder="0.00" className="min-w-0 flex-1 rounded-r-md px-3 text-sm outline-none" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Up to {peso.format(selectedAvailableCredit)}</p>
                </div>
                <div>
                  <label htmlFor="custom-late-fee" className="block text-sm font-medium text-gray-700">Custom late fee</label>
                  <div className="mt-2 flex min-h-11 rounded-md border border-gray-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20">
                    <span className="grid place-items-center border-r border-gray-200 px-3 text-sm text-gray-500" aria-hidden="true">₱</span>
                    <input id="custom-late-fee" type="number" min="0" step="0.01" required value={lateFee} onChange={(event) => { setLateFee(event.target.value); setOfferSubmitted(false); setConfirmation(''); setFormError(''); }} placeholder="0.00" className="min-w-0 flex-1 rounded-r-md px-3 text-sm outline-none" />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="credit-description" className="block text-sm font-medium text-gray-700">Loan purpose / description</label>
                  <textarea id="credit-description" rows="3" value={description} onChange={(event) => { setDescription(event.target.value); setOfferSubmitted(false); setConfirmation(''); setFormError(''); }} placeholder="Example: Working capital for retail inventory restock" className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" />
                  <p className="mt-1 text-xs text-gray-500">Optional, but useful for borrowers to see exactly why the credit was issued.</p>
                </div>
                <div>
                  <label htmlFor="interest-rate" className="block text-sm font-medium text-gray-700">Interest rate (%)</label>
                  <select id="interest-rate" required value={interestRate} onChange={(event) => { setInterestRate(event.target.value); setOfferSubmitted(false); setConfirmation(''); setFormError(''); }} className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="10">10%</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="due-timeframe" className="block text-sm font-medium text-gray-700">Due date / timeframe</label>
                  <select id="due-timeframe" required value={dueDays} onChange={(event) => { setDueDays(event.target.value); setOfferSubmitted(false); setConfirmation(''); setFormError(''); }} className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20">
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={isBlocked || isSavingOffer || offerSubmitted} className="min-h-11 w-full rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
                    {isSavingOffer ? 'Saving offer...' : offerSubmitted ? 'Offer submitted' : 'Submit credit offer'}
                  </button>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">
                  <p className="font-semibold">Offer preview</p>
                  <p className="mt-1 text-xs leading-5">
                    Principal: {peso.format(offerPrincipal)} · Interest ({interestRate}%): {peso.format(offerTotals.interest)} · Total due: {peso.format(offerTotals.totalDue)}
                  </p>
                  <p className="text-xs">Payment timeframe: {formatPaymentTimeframe(offerDueDate)}</p>
                </div>
              </fieldset>
              {isBlocked && <p className="mt-4 text-sm font-medium text-red-800" role="status">New credit offers are unavailable while this account has overdue debt.</p>}
              {formError && <p className="mt-4 text-sm font-medium text-red-800" role="alert">{formError}</p>}
              {confirmation && <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800" role="status">{confirmation}</p>}
            </form>
          </section>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">Search for a borrower with an active Firestore loan.</p>
            <p className="mt-1 text-sm text-gray-500">Borrowers without an active loan profile will not appear here yet.</p>
        </div>
      )}
      </div>

      <div id="payment-panel" role="tabpanel" aria-labelledby="payment-tab" hidden={activeTab !== 'payment'}>
        <section aria-labelledby="payment-customer-heading" className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
          <div className="max-w-2xl">
            <h2 id="payment-customer-heading" className="text-lg font-semibold">Find a customer</h2>
            <label htmlFor="payment-customer-search" className="mt-4 block text-sm font-medium text-gray-700">Customer search</label>
            <input
              id="payment-customer-search"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={matchingPaymentCustomers.length > 0 && !paymentCustomer}
              aria-controls="payment-customer-results"
              placeholder="Search customers with an outstanding balance"
              value={paymentSearch}
              onChange={(event) => {
                setPaymentSearch(event.target.value);
                setPaymentCustomerId('');
                setPaymentConfirmation('');
                setPaymentError('');
              }}
              className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />
            {matchingPaymentCustomers.length > 0 && !paymentCustomer && (
              <ul id="payment-customer-results" role="listbox" className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
                {matchingPaymentCustomers.map((customer) => (
                  <li key={customer.id} role="option" aria-selected="false">
                    <button type="button" onClick={() => selectPaymentCustomer(customer)} className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none">
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{customer.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{customer.id} · {customer.latestTransactionDate}</span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-800">{peso.format(customer.outstandingBalance)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {paymentSearch.trim() && !matchingPaymentCustomers.length && !paymentCustomer && (
              <p className="mt-2 text-sm text-gray-500">No customer with an outstanding balance matches that search.</p>
            )}
          </div>
        </section>

        {paymentError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{paymentError}</p>}
        {paymentConfirmation && <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{paymentConfirmation}</p>}

        {verificationQueue.length > 0 && (
          <section aria-labelledby="verification-queue-heading" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="verification-queue-heading" className="text-lg font-semibold text-amber-950">Payment verification queue</h2>
                <p className="mt-1 text-sm text-amber-900">Receipts uploaded by borrowers awaiting confirmation.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{verificationQueue.length} pending</span>
            </div>

            <div className="mt-5 space-y-4">
              {verificationQueue.map((loan) => (
                <div key={loan.id} className="rounded-lg border border-amber-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{loan.borrowerName || 'Borrower'}</p>
                      <p className="mt-1 text-sm text-gray-600">Loan: {loan.id}</p>
                      <p className="mt-1 text-sm text-gray-600">Amount: {peso.format(loan.principal || 0)}</p>
                      {loan.description && <p className="mt-1 text-sm text-gray-600">Purpose: {loan.description}</p>}
                    </div>
                    {loan.paymentProofUrl ? (
                      <a href={loan.paymentProofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">
                        View receipt
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-gray-500">No receipt</span>
                    )}
                  </div>

                  {loan.paymentProofUrl && (
                    <div className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      <img src={loan.paymentProofUrl} alt={`Payment proof for ${loan.borrowerName || 'loan borrower'}`} className="max-h-60 w-full object-contain" />
                    </div>
                  )}

                  <button type="button" onClick={() => confirmPaymentVerification(loan)} disabled={!loan.paymentProofUrl || verifyingLoanId === loan.id} className="mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
                    {verifyingLoanId === loan.id ? 'Confirming...' : 'Confirm & Mark as Paid'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {verificationQueueError && <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{verificationQueueError}</p>}

        {paymentCustomer ? (
          <>
            <section aria-labelledby="outstanding-history-heading" className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                <div>
                  <p className="text-sm text-gray-500">Outstanding balance history</p>
                  <h2 id="outstanding-history-heading" className="mt-1 text-lg font-semibold">{paymentCustomer.name}</h2>
                </div>
                <p className="text-sm text-gray-600">Current balance <span className="ml-1 font-bold tabular-nums text-gray-950">{peso.format(paymentCustomer.outstandingBalance)}</span></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Credit reference</th>
                      <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Date opened</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Original amount</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold sm:px-6">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentCustomer.outstandingHistory.length ? paymentCustomer.outstandingHistory.map((entry) => (
                      <tr key={entry.id}>
                        <th scope="row" className="px-5 py-4 font-semibold text-gray-900 sm:px-6">{entry.id}</th>
                        <td className="px-5 py-4 text-gray-600 sm:px-6">{entry.date}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-gray-700 sm:px-6">{peso.format(entry.originalAmount)}</td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900 sm:px-6">{peso.format(entry.outstandingAmount)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="px-5 py-10 text-center text-sm text-gray-500 sm:px-6">No outstanding balance history found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby="receive-payment-heading" className="mt-6 rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
              <div className="mb-5">
                <h2 id="receive-payment-heading" className="text-lg font-semibold">Record payment</h2>
                <p className="mt-1 text-sm text-gray-500">Payment will be allocated to the oldest outstanding credit first.</p>
              </div>
              <form onSubmit={handlePaymentSubmit} onInvalid={() => setPaymentError('Complete the payment amount before submitting.')}>
                <fieldset disabled={isRecordingPayment} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
                  <legend className="sr-only">Payment details</legend>
                  <div>
                    <label htmlFor="payment-amount" className="block text-sm font-medium text-gray-700">Payment amount</label>
                    <div className="mt-2 flex min-h-11 rounded-md border border-gray-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20">
                      <span className="grid place-items-center border-r border-gray-200 px-3 text-sm text-gray-500" aria-hidden="true">₱</span>
                      <input id="payment-amount" type="number" min="0.01" max={paymentCustomer.outstandingBalance} step="0.01" required value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0.00" className="min-w-0 flex-1 rounded-r-md px-3 text-sm outline-none" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Up to {peso.format(paymentCustomer.outstandingBalance)}</p>
                  </div>
                  <div>
                    <label htmlFor="payment-channel" className="block text-sm font-medium text-gray-700">Payment channel</label>
                    <select id="payment-channel" value={paymentChannel} onChange={(event) => setPaymentChannel(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20">
                      <option value="Cash">Cash</option>
                      <option value="E-Wallet">E-Wallet</option>
                    </select>
                  </div>
                </fieldset>
                <button type="submit" disabled={paymentCustomer.outstandingBalance <= 0 || isRecordingPayment} className="mt-5 min-h-11 rounded-md bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
                  {isRecordingPayment ? 'Recording payment...' : 'Submit payment'}
                </button>
                <p className="mt-2 text-xs text-gray-500">FIFO (First-In, First-Out) Automated Settlement Applied</p>
              </form>
            </section>
          </>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 px-5 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">Search for a customer to review outstanding balances and record a payment.</p>
          </div>
        )}
      </div>

      <div id="directory-panel" role="tabpanel" aria-labelledby="directory-tab" hidden={activeTab !== 'directory'}>
        <UnpaidCustomerDirectory loans={loans} loading={loansLoading} error={loansError} />
      </div>

      <div id="approvals-panel" role="tabpanel" aria-labelledby="approvals-tab" hidden={activeTab !== 'approvals'}>
        <section aria-labelledby="pending-approvals-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="pending-approvals-heading" className="text-lg font-semibold">Borrower approval queue</h2>
              <p className="mt-1 text-sm text-gray-500">Approval is required before borrower credit features are available.</p>
            </div>
            <span className="text-sm text-gray-500">{pendingBorrowers.length} pending</span>
          </div>
          {approvalLoading && <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">Loading pending registrations...</p>}
          {approvalNotice && <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{approvalNotice}</p>}
          {!approvalLoading && !approvalError && pendingBorrowers.length === 0 ? (
            <p className="border-y border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">No pending borrower approvals.</p>
          ) : !approvalError && (
            <ul className="divide-y divide-gray-200 border-y border-gray-200 bg-white">
              {pendingBorrowers.map((borrower) => (
                <li key={borrower.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <div>
                    <p className="font-semibold text-gray-900">{borrower.name || 'New borrower'}</p>
                    <p className="mt-1 text-sm text-gray-600">{borrower.email}</p>
                    <p className="mt-1 text-xs text-gray-500">{borrower.phoneNumber || 'No phone number'} · {borrower.occupation || 'Occupation not provided'}</p>
                    <p className="mt-1 text-xs text-gray-500">Salary range: {borrower.monthlySalary || 'Not provided'} · ID: {borrower.idType || 'Not uploaded'}</p>
                  </div>
                  <button type="button" onClick={() => approveBorrower(borrower)} disabled={approvingUserId === borrower.id} className="min-h-10 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
                    {approvingUserId === borrower.id ? 'Approving...' : 'Approve'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}