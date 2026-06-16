import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import User from "../models/User.js";
import sendEmail from "./sendemail.js";

export const checkBudgetThresholds = async (userId, category, amountAdded) => {
  try {
    // 1. Fetch User and Budget
    const user = await User.findById(userId);
    const budget = await Budget.findOne({ userId });

    if (!user || !budget) return;

    // 2. Determine target budget (category-specific or fallback to total)
    let targetBudget = 0;
    if (budget.categoryTargets && budget.categoryTargets[category]) {
      targetBudget = Number(budget.categoryTargets[category]);
    }
    if (targetBudget === 0) {
      targetBudget = Number(budget.totalBudget || 0);
    }
    if (targetBudget === 0) return; // No cap set

    // 3. Calculate current total expenses for this category
    const categoryExpenses = await Expense.find({ userId, category });
    const currentTotal = categoryExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const previousTotal = currentTotal - Number(amountAdded);

    // 4. Calculate percentage metrics
    const currentPercent = (currentTotal / targetBudget) * 100;
    const previousPercent = (previousTotal / targetBudget) * 100;

    let triggerMilestone = null;
    if (previousPercent < 50 && currentPercent >= 50 && currentPercent < 80) {
      triggerMilestone = 50;
    } else if (previousPercent < 80 && currentPercent >= 80 && currentPercent < 100) {
      triggerMilestone = 80;
    } else if (previousPercent < 100 && currentPercent >= 100) {
      triggerMilestone = 100;
    }

    // 5. Send email if milestone crossed
    if (triggerMilestone) {
      const emailSubject = `⚠️ SmartBudget Alert: ${triggerMilestone}% of your Budget Reached!`;

      const emailBody = `
        <div style="font-family: sans-serif; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h3 style="color: #0f172a;">Hello ${user.name || "User"},</h3>
          <p>Your expenses for the category <b>"${category}"</b> have reached <b>${currentPercent.toFixed(1)}%</b> of your allocated limit.</p>
          <table style="border: 1px solid #e2e8f0; border-collapse: collapse; width: 100%; margin: 15px 0;">
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Metrics</th>
              <th style="padding: 10px; border: 1px solid #e2e8f0;">Value</th>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Category Limit</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">₹${targetBudget.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Current Spending</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">₹${currentTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">Milestone</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">
                <span style="background-color: #fef2f2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                  ${triggerMilestone}% Cleared
                </span>
              </td>
            </tr>
          </table>
          <p style="margin-top: 20px; font-size: 13px; color: #64748b;">Please review your dashboard to optimize allocations.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 20px;"/>
          <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; Smart Budget Analyzer. Academic Capstone Project.</p>
        </div>
      `;

      await sendEmail(user.email, emailSubject, emailBody);
    }
  } catch (err) {
    console.error("🚨 Budget Alert Engine Failure:", err.message);
  }
};
