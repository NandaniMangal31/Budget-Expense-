import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import User from "../models/User.js";
import sendEmail from "./sendemail.js";

/**
 * 🧠 High-Speed Asynchronous Budget Monitoring Engine
 * Calculates limit variations and fires transactional email alerts via aggregation pipelines
 */
export const checkBudgetThresholds = async (userId, category, amountAdded) => {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.warn("⚠️ Budget engine skipped execution due to invalid or unmapped account reference ID:", userId);
      return;
    }

    // 1. Fetch target configurations and profile details concurrently
    const [user, budget] = await Promise.all([
      User.findById(userId),
      Budget.findOne({ userId })
    ]);

    if (!user || !budget) return;

    // 2. Resolve matching limit thresholds (Fall back to total budget if category is unmapped)
    let targetBudget = budget.categoryTargets?.[category] || budget.totalBudget || 0;
    if (targetBudget === 0) return; // No upper boundary configured, exit gracefully

    // 🎯 3. HIGH-SPEED AGGREGATION OPTIMIZATION
    // Instead of downloading thousands of documents to memory, sum them instantly at the DB layer
    const aggregationResult = await Expense.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), category: category } },
      { $group: { _id: null, totalSpent: { $sum: "$amount" } } }
    ]);

    // Calculate boundary milestones safely using the aggregated database numbers
    const currentTotal = aggregationResult[0]?.totalSpent || 0;
    const previousTotal = currentTotal - amountAdded;
    
    // 4. Calculate exact tracking percentages
    const currentPercent = (currentTotal / targetBudget) * 100;
    const previousPercent = (previousTotal / targetBudget) * 100;

    let triggerMilestone = null;

    // Precise boundary transitions to maintain absolute transactional single-trigger delivery rules
    if (previousPercent < 50 && currentPercent >= 50 && currentPercent < 80) {
      triggerMilestone = 50;
    } else if (previousPercent < 80 && currentPercent >= 80 && currentPercent < 100) {
      triggerMilestone = 80;
    } else if (previousPercent < 100 && currentPercent >= 100) {
      triggerMilestone = 100;
    }

    // 5. Dispatch rich HTML newsletter templates if a milestone boundary is crossed
    if (triggerMilestone) {
      const emailSubject = `⚠️ SmartBudget Notification: ${triggerMilestone}% Limit Reached!`;
      
      const emailBody = `
        <div style="font-family: Arial, sans-serif; color: #334155; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <h3 style="color: #0f172a; margin-top: 0;">Hello ${user.name || "User"},</h3>
          <p style="font-size: 14px; line-height: 1.5;">This is an automated threshold warning triggered from your <b>Smart Budget Analyzer</b> workspace.</p>
          <p style="font-size: 14px; line-height: 1.5;">Your total spending logs inside the category <b>"${category}"</b> have reached <b>${currentPercent.toFixed(1)}%</b> of your target benchmark limit.</p>
          
          <table style="border: 1px solid #e2e8f0; border-collapse: collapse; width: 100%; margin: 20px 0; font-size: 14px;">
            <tr style="background-color: #f8fafc;">
              <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: left;">Tracking Layer</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; text-align: left;">Financial Value</th>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">Allocated Target Cap</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">₹${targetBudget.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">Aggregated Active Ledger</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0; color: #dc2626; font-weight: bold;">₹${currentTotal.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">System Operational Status</td>
              <td style="padding: 12px; border: 1px solid #e2e8f0;">
                <span style="background-color: #fef2f2; color: #b91c1c; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-block;">
                  ${triggerMilestone}% Milestone Triggered
                </span>
              </td>
            </tr>
          </table>
          
          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">Log in to your workspace analytics control board to adjust limits dynamically.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;"/>
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">&copy; Smart Budget Analyzer. Academic Capstone Security Layer.</p>
        </div>
      `;

      await sendEmail(user.email, emailSubject, emailBody);
    }
  } catch (err) {
    console.error("🚨 Budget Alert Engine Core Operation Failure:", err.message);
  }
};