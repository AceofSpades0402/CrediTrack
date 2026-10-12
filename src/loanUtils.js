export function calculateLoanTotals(principal, interestRate) {
    const interest = Math.round((principal * interestRate / 100 + Number.EPSILON) * 100) / 100;
    return {
        interest,
        totalDue: Math.round((principal + interest + Number.EPSILON) * 100) / 100,
    };
}

export function getDaysUntilDue(dueDate, referenceDate = new Date()) {
    if (!dueDate) return null;

    const [year, month, day] = dueDate.split('-').map(Number);
    const dueDay = new Date(year, month - 1, day);
    const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    return Math.round((dueDay - today) / 86400000);
}

export function getDateAfterDays(days, referenceDate = new Date()) {
    const dueDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
    dueDate.setDate(dueDate.getDate() + days);
    return [dueDate.getFullYear(), String(dueDate.getMonth() + 1).padStart(2, '0'), String(dueDate.getDate()).padStart(2, '0')].join('-');
}

export function formatPaymentTimeframe(dueDate) {
    const daysUntilDue = getDaysUntilDue(dueDate);
    if (daysUntilDue === null) return 'No payment deadline set';
    if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} ${Math.abs(daysUntilDue) === 1 ? 'day' : 'days'}`;
    if (daysUntilDue === 0) return 'Due today';
    return `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`;
}