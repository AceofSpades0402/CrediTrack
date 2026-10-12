export default function BadgeLegend({ className = '' }) {
  const statuses = [
    {
      label: 'Good Standing',
      description: 'Account is clear and has available credit limit.',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      dotClass: 'bg-emerald-600',
    },
    {
      label: 'Warning: Near Limit',
      description: 'In good standing, but approaching the maximum credit limit.',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-950',
      dotClass: 'bg-amber-500',
    },
    {
      label: 'Delinquent / Banned / Blocked',
      description: 'Past the payment timeframe and restricted from borrowing.',
      badgeClass: 'border-red-200 bg-red-50 text-red-900',
      dotClass: 'bg-red-600',
    },
  ];

  return (
    <section aria-label="Badge legend" className={`rounded-md border border-gray-200 bg-white px-4 py-3 ${className}`}>
      <h2 className="text-xs font-bold uppercase text-gray-700">Badge legend</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {statuses.map((status) => (
          <li key={status.label} className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${status.badgeClass}`}>
              <span className={`size-1.5 rounded-full ${status.dotClass}`} aria-hidden="true" />
              {status.label}
            </span>
            <p className="mt-1 text-xs leading-5 text-gray-600">{status.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}