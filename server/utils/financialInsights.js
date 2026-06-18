/**
 * Data-driven financial insights — no fabricated numbers.
 * Uses only computed totals from real expense/income arrays.
 */

const parseAmount = (val) => {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
};

export const buildFinancialSummary = (expenses = [], budgetConfig = {}) => {
  const expenseLogs = expenses.filter((e) => e.transactionType !== "received");
  const receivedLogs = expenses.filter((e) => e.transactionType === "received");

  const totalExpenses = expenseLogs.reduce((sum, e) => sum + parseAmount(e.amount), 0);
  const totalIncome = receivedLogs.reduce((sum, e) => sum + parseAmount(e.amount), 0);
  const totalBudget = parseAmount(budgetConfig.totalBudget);
  const netSavings = totalIncome - totalExpenses;
  const budgetRemaining = totalBudget - totalExpenses;
  const budgetUtilization = totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

  const categoryTotals = expenseLogs.reduce((acc, item) => {
    const cat = item.category || "Other";
    acc[cat] = (acc[cat] || 0) + parseAmount(item.amount);
    return acc;
  }, {});

  return {
    totalExpenses,
    totalIncome,
    netSavings,
    totalBudget,
    budgetRemaining,
    budgetUtilization,
    categoryTotals,
    expenseCount: expenseLogs.length,
    incomeCount: receivedLogs.length,
  };
};

export const generateLocalInsights = (expenses = [], budgetConfig = {}) => {
  const summary = buildFinancialSummary(expenses, budgetConfig);
  const insights = [];

  if (summary.expenseCount === 0 && summary.incomeCount === 0) {
    return { insights: ["Add expenses or scan documents to generate insights."], summary };
  }

  if (summary.totalBudget > 0) {
    const pct = Math.round(summary.budgetUtilization);
    insights.push(`You have used ${pct}% of your monthly budget (₹${summary.totalExpenses.toLocaleString("en-IN")} of ₹${summary.totalBudget.toLocaleString("en-IN")}).`);
    if (pct >= 100) {
      insights.push("Your budget is fully used. Consider pausing non-essential spending.");
    } else if (pct >= 80) {
      insights.push("You are approaching your budget limit. Review discretionary categories.");
    }
  }

  const sortedCategories = Object.entries(summary.categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0 && summary.totalExpenses > 0) {
    const [topCat, topAmt] = sortedCategories[0];
    const topPct = Math.round((topAmt / summary.totalExpenses) * 100);
    insights.push(`You spent ${topPct}% of expenses on ${topCat}.`);
  }

  if (sortedCategories.length >= 2 && summary.totalBudget > 0) {
    const targets = budgetConfig.categoryTargets || {};
    for (const [cat, spent] of sortedCategories) {
      const target = parseAmount(targets[cat]);
      if (target > 0 && spent > target) {
        const over = Math.round(spent - target);
        insights.push(`${cat} is ₹${over.toLocaleString("en-IN")} over your category target.`);
      }
    }
  }

  const entertainment = summary.categoryTotals.Entertainment || 0;
  if (entertainment > 0 && summary.totalExpenses > 0) {
    const entPct = entertainment / summary.totalExpenses;
    if (entPct >= 0.15) {
      const potentialSave = Math.round(entertainment * 0.3);
      insights.push(
        `You could save approximately ₹${potentialSave.toLocaleString("en-IN")} monthly by reducing entertainment spending by 30%.`,
      );
    }
  }

  if (summary.totalIncome > 0) {
    insights.push(
      `Total income received: ₹${summary.totalIncome.toLocaleString("en-IN")}. Net position: ₹${summary.netSavings.toLocaleString("en-IN")}.`,
    );
  }

  return { insights: insights.slice(0, 6), summary };
};

export default { buildFinancialSummary, generateLocalInsights };
