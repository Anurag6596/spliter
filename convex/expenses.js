import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ───────────── Create a new expense ───────────── */
export const createExpense = mutation({
  args: {
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp in ms
    paidByUserId: v.id("users"),
    splitType: v.string(), // "equal", "percentage", "exact"
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    // Current user nikalna central function se
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Agar group hai toh check karo ki user group ka member hai ya nahi
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) throw new Error("Group not found");

      const isMember = group.members.some(
        (member) => member.userId === user._id
      );
      if (!isMember) throw new Error("You are not a member of this group");
    }

    // Verify karo ki splits ka total amount expense ke equal hai (thoda rounding tolerance allowed)
    const totalSplitAmount = args.splits.reduce(
      (sum, split) => sum + split.amount,
      0
    );
    const tolerance = 0.01;
    if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
      throw new Error("Split amounts must add up to the total expense amount");
    }

    // Expense create karna DB mein
    const expenseId = await ctx.db.insert("expenses", {
      description: args.description,
      amount: args.amount,
      category: args.category || "Other",
      date: args.date,
      paidByUserId: args.paidByUserId,
      splitType: args.splitType,
      splits: args.splits,
      groupId: args.groupId,
      createdBy: user._id,
    });

    return expenseId;
  },
});

/* ───────────── Get one-on-one expenses with any user ───────────── */
export const getExpensesBetweenUsers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.runQuery(internal.users.getCurrentUser);
    if (me._id === userId) throw new Error("Cannot query yourself");

    // 1. One-on-one expenses fetch karo (sirf non-group expenses)
    const myPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", me._id).eq("groupId", undefined)
      )
      .collect();

    const theirPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", userId).eq("groupId", undefined)
      )
      .collect();

    // Merge karo dono lists → ab candidate expenses mile
    const candidateExpenses = [...myPaid, ...theirPaid];

    // 2. Filter karo sirf wahi jisme dono users involve hai (payer ya splits mein)
    const expenses = candidateExpenses.filter((e) => {
      const meInSplits = e.splits.some((s) => s.userId === me._id);
      const themInSplits = e.splits.some((s) => s.userId === userId);

      const meInvolved = e.paidByUserId === me._id || meInSplits;
      const themInvolved = e.paidByUserId === userId || themInSplits;

      return meInvolved && themInvolved;
    });

    // Latest first sort
    expenses.sort((a, b) => b.date - a.date);

    // 3. Settlements fetch karo jo sirf hum dono ke beech hue ho (group ke bina)
    const settlements = await ctx.db
      .query("settlements")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), undefined),
          q.or(
            q.and(
              q.eq(q.field("paidByUserId"), me._id),
              q.eq(q.field("receivedByUserId"), userId)
            ),
            q.and(
              q.eq(q.field("paidByUserId"), userId),
              q.eq(q.field("receivedByUserId"), me._id)
            )
          )
        )
      )
      .collect();

    settlements.sort((a, b) => b.date - a.date);

    // 4. Running balance nikalna (positive -> wo mujhe paisa dene wale, negative → main unko dene wala)
    let balance = 0;

    for (const e of expenses) {
      if (e.paidByUserId === me._id) {
        const split = e.splits.find((s) => s.userId === userId && !s.paid);
        if (split) balance += split.amount; // wo mujhe dene wale
      } else {
        const split = e.splits.find((s) => s.userId === me._id && !s.paid);
        if (split) balance -= split.amount; // main unko dene wala
      }
    }

    for (const s of settlements) {
      if (s.paidByUserId === me._id) balance += s.amount; // mainne unhe de diya
      else balance -= s.amount; // unhone mujhe de diya
    }

    // 5. Other user details fetch karke final response
    const other = await ctx.db.get(userId);
    if (!other) throw new Error("User not found");

    return {
      expenses,
      settlements,
      otherUser: {
        id: other._id,
        name: other.name,
        email: other.email,
        imageUrl: other.imageUrl,
      },
      balance,
    };
  },
});

/* ───────────── Delete an expense ───────────── */
export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    // Current user nikal lo
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    // Expense fetch karo
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");

    // Sirf creator ya payer hi delete kar sakta hai
    if (expense.createdBy !== user._id && expense.paidByUserId !== user._id) {
      throw new Error("You don't have permission to delete this expense");
    }

    // Related settlements bhi check karo aur clean karo
    const allSettlements = await ctx.db.query("settlements").collect();

    const relatedSettlements = allSettlements.filter(
      (settlement) =>
        settlement.relatedExpenseIds !== undefined &&
        settlement.relatedExpenseIds.includes(args.expenseId)
    );

    for (const settlement of relatedSettlements) {
      const updatedRelatedExpenseIds = settlement.relatedExpenseIds.filter(
        (id) => id !== args.expenseId
      );

      if (updatedRelatedExpenseIds.length === 0) {
        // Agar aur koi expense link nahi hai → pura settlement delete
        await ctx.db.delete(settlement._id);
      } else {
        // Warna sirf expense id remove kar do
        await ctx.db.patch(settlement._id, {
          relatedExpenseIds: updatedRelatedExpenseIds,
        });
      }
    }

    // Finally expense delete karo
    await ctx.db.delete(args.expenseId);

    return { success: true };
  },
});
