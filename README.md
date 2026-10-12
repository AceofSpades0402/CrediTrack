# Fieldnote micro-credit app

## Project structure

```text
microcredit-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── App.js
    ├── AppContext.jsx
    ├── index.css
    ├── main.jsx
    └── components/
        ├── AuthLayout.jsx
        ├── BorrowerDashboard.jsx
        ├── Login.jsx
        ├── MainLayout.jsx
        └── Signup.jsx
```

## Run locally

Install Node.js, then run:

```sh
npm install
npm run dev
```

The context provides a borrower/lender role toggle, mocked user details, a risk-status selector that recalculates credit limits, and transaction history. The UI includes a mock profile QR ID, borrower credit dashboard, statement entries, and due-date alerts. Authentication and KYC interactions are demo-only; all data remains in-memory.