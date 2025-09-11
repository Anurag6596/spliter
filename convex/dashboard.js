import { query } from "./_generated/server";
import { internal } from "./_generated/api";

// User ke balances nikalne ka query
export const getUserBalances = query({
  handler: async (ctx) => {
    // Direct getCurrentUser use kar rahe hain, auth logic repeat nahi karna
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    /* ───────────── 1-to-1 expenses (jisme groupId nahi hai) ───────────── */
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) =>
        !e.groupId && // sirf 1-to-1 ke liye
        (e.paidByUserId === user._id ||
          e.splits.some((s) => s.userId === user._id))
    );

    /* Total calculate karna */
    let youOwe = 0;
    let youAreOwed = 0;
    const balanceByUser = {};

    for (const e of expenses) {
      const isPayer = e.paidByUserId === user._id;
      const mySplit = e.splits.find((s) => s.userId === user._id);

      if (isPayer) {
        for (const s of e.splits) {
          if (s.userId === user._id || s.paid) continue;
          youAreOwed += s.amount;
          (balanceByUser[s.userId] ??= { owed: 0, owing: 0 }).owed += s.amount;
        }
      } else if (mySplit && !mySplit.paid) {
        youOwe += mySplit.amount;
        (balanceByUser[e.paidByUserId] ??= { owed: 0, owing: 0 }).owing +=
          mySplit.amount;
      }
    }

    /* ───────────── 1-to-1 settlements (jisme groupId nahi hai) ───────────── */
    const settlements = (await ctx.db.query("settlements").collect()).filter(
      (s) =>
        !s.groupId &&
        (s.paidByUserId === user._id || s.receivedByUserId === user._id)
    );

    for (const s of settlements) {
      if (s.paidByUserId === user._id) {
        youOwe -= s.amount;
        (balanceByUser[s.receivedByUserId] ??= { owed: 0, owing: 0 }).owing -=
          s.amount;
      } else {
        youAreOwed -= s.amount;
        (balanceByUser[s.paidByUserId] ??= { owed: 0, owing: 0 }).owed -=
          s.amount;
      }
    }

    /* UI ke liye lists banana */
    const youOweList = [];
    const youAreOwedByList = [];
    for (const [uid, { owed, owing }] of Object.entries(balanceByUser)) {
      const net = owed - owing;
      if (net === 0) continue;
      const counterpart = await ctx.db.get(uid);
      const base = {
        userId: uid,
        name: counterpart?.name ?? "Unknown",
        imageUrl: counterpart?.imageUrl,
        amount: Math.abs(net),
      };
      net > 0 ? youAreOwedByList.push(base) : youOweList.push(base);
    }

    youOweList.sort((a, b) => b.amount - a.amount);
    youAreOwedByList.sort((a, b) => b.amount - a.amount);

    return {
      youOwe,
      youAreOwed,
      totalBalance: youAreOwed - youOwe,
      oweDetails: { youOwe: youOweList, youAreOwedBy: youAreOwedByList },
    };
  },
});

// Current year me total kitna kharcha hua
export const getTotalSpent = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Current year ka start timestamp
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    // Current year ke saare expenses lao
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    // Sirf wahi expenses jaha user involved hai
    const userExpenses = expenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((split) => split.userId === user._id)
    );

    // Sirf apna personal share add karna
    let totalSpent = 0;

    userExpenses.forEach((expense) => {
      const userSplit = expense.splits.find(
        (split) => split.userId === user._id
      );
      if (userSplit) {
        totalSpent += userSplit.amount;
      }
    });

    return totalSpent;
  },
});

// Monthly spending nikalna
export const getMonthlySpending = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Current year ka data lena
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    // Current year ke saare expenses
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", startOfYear))
      .collect();

    // Sirf wahi jaha user involved hai
    const userExpenses = allExpenses.filter(
      (expense) =>
        expense.paidByUserId === user._id ||
        expense.splits.some((split) => split.userId === user._id)
    );

    // Month-wise group karna
    const monthlyTotals = {};

    // Sabhi months ko zero se initialize karna
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentYear, i, 1);
      monthlyTotals[monthDate.getTime()] = 0;
    }

    // Month-wise add karna
    userExpenses.forEach((expense) => {
      const date = new Date(expense.date);
      const monthStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        1
      ).getTime();

      // User ka share nikalna
      const userSplit = expense.splits.find(
        (split) => split.userId === user._id
      );
      if (userSplit) {
        monthlyTotals[monthStart] =
          (monthlyTotals[monthStart] || 0) + userSplit.amount;
      }
    });

    // Array format me convert karna
    const result = Object.entries(monthlyTotals).map(([month, total]) => ({
      month: parseInt(month),
      total,
    }));

    // Month ascending order me sort karna
    result.sort((a, b) => a.month - b.month);

    return result;
  },
});

// User ke groups lana
export const getUserGroups = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Saare groups lao
    const allGroups = await ctx.db.query("groups").collect();

    // Sirf wahi groups jaha user member hai
    const groups = allGroups.filter((group) =>
      group.members.some((member) => member.userId === user._id)
    );

    // Har group ka balance calculate karna
    const enhancedGroups = await Promise.all(
      groups.map(async (group) => {
        // Is group ke saare expenses lao
        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        let balance = 0;

        expenses.forEach((expense) => {
          if (expense.paidByUserId === user._id) {
            // User ne dusro ke liye pay kiya
            expense.splits.forEach((split) => {
              if (split.userId !== user._id && !split.paid) {
                balance += split.amount;
              }
            });
          } else {
            // User kisi aur ko paisa dena hai
            const userSplit = expense.splits.find(
              (split) => split.userId === user._id
            );
            if (userSplit && !userSplit.paid) {
              balance -= userSplit.amount;
            }
          }
        });

        // Settlements apply karna
        const settlements = await ctx.db
          .query("settlements")
          .filter((q) =>
            q.and(
              q.eq(q.field("groupId"), group._id),
              q.or(
                q.eq(q.field("paidByUserId"), user._id),
                q.eq(q.field("receivedByUserId"), user._id)
              )
            )
          )
          .collect();

        settlements.forEach((settlement) => {
          if (settlement.paidByUserId === user._id) {
            // User ne kisi ko pay kiya
            balance += settlement.amount;
          } else {
            // Kisi ne user ko pay kiya
            balance -= settlement.amount;
          }
        });

        return {
          ...group,
          id: group._id,
          balance,
        };
      })
    );

    return enhancedGroups;
  },
});
