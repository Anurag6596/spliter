import { query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/* ───────────── getGroupOrMembers ───────────── */
export const getGroupOrMembers = query({
  args: {
    groupId: v.optional(v.id("groups")), 
    // groupId optional hai → agar diya to ek hi group ke details aayenge
    // agar nahi diya to saare user ke groups aayenge
  },
  handler: async (ctx, args) => {
    // current logged-in user nikalna (centralized function se)
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // saare groups nikal lo DB se
    const allGroups = await ctx.db.query("groups").collect();

    // ab filter karo → user sirf wahi groups dekhe jisme wo member ho
    const userGroups = allGroups.filter((group) =>
      group.members.some((member) => member.userId === currentUser._id)
    );

    /* ---- Case 1: agar groupId diya hai ---- */
    if (args.groupId) {
      // check karo ki user ka group hai ya nahi
      const selectedGroup = userGroups.find(
        (group) => group._id === args.groupId
      );

      if (!selectedGroup) {
        throw new Error("Group nahi mila ya fir tum member nahi ho");
      }

      // is group ke saare members ke details nikal lo
      const memberDetails = await Promise.all(
        selectedGroup.members.map(async (member) => {
          const user = await ctx.db.get(member.userId);
          if (!user) return null; // agar user delete ho gaya ho to skip

          return {
            id: user._id,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            role: member.role, // member ka role group me
          };
        })
      );

      // null values hata do
      const validMembers = memberDetails.filter((member) => member !== null);

      // return karo → selected group + saare groups ki chhoti list
      return {
        selectedGroup: {
          id: selectedGroup._id,
          name: selectedGroup.name,
          description: selectedGroup.description,
          createdBy: selectedGroup.createdBy,
          members: validMembers,
        },
        groups: userGroups.map((group) => ({
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
        })),
      };
    } else {
      /* ---- Case 2: agar groupId nahi diya ---- */
      // sirf groups ki list return karo (members ke bina)
      return {
        selectedGroup: null,
        groups: userGroups.map((group) => ({
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
        })),
      };
    }
  },
});

/* ───────────── getGroupExpenses ───────────── */
export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    // current user le aao
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // group fetch karo
    const group = await ctx.db.get(groupId);
    if (!group) throw new Error("Group nahi mila");

    // check karo user member hai ya nahi
    if (!group.members.some((m) => m.userId === currentUser._id))
      throw new Error("Tum is group ke member nahi ho");

    // group ke saare expenses lao
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();

    // group ke settlements lao
    const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.eq(q.field("groupId"), groupId))
      .collect();

    /* ---------- members ke details ---------- */
    const memberDetails = await Promise.all(
      group.members.map(async (m) => {
        const u = await ctx.db.get(m.userId);
        return { id: u._id, name: u.name, imageUrl: u.imageUrl, role: m.role };
      })
    );
    const ids = memberDetails.map((m) => m.id);

    /* ---------- ledgers setup ---------- */
    // total balance map banao (sabko initially 0 balance)
    const totals = Object.fromEntries(ids.map((id) => [id, 0]));

    // pair-wise ledger (kaun kis se paise lena/dena hai)
    // ledger[a][b] = amount means a owes b 'amount'
    // initially sab 0
    // example: { user1: { user2: 0, user3: 0 }, user2: { user1: 0, user3: 0 }, ... }
    const ledger = {};
    ids.forEach((a) => {
      ledger[a] = {};
      ids.forEach((b) => {
        if (a !== b) ledger[a][b] = 0;
      });
    });

    /* ---------- expenses apply karo ---------- */
    // har expense ke liye:
    // - payer ka balance badhao (total mein)
    // - har debtor ka balance kam karo (total mein)
    // - pair-wise ledger update karo
    // e.g. agar A ne 300 ka expense dala jisme B aur C ko 100-100 dena hai:
    for (const exp of expenses) {
      const payer = exp.paidByUserId;
      for (const split of exp.splits) {
        if (split.userId === payer || split.paid) continue; 
        // payer ko skip karo + jo already settled hai unhe bhi

        const debtor = split.userId;
        const amt = split.amount;

        totals[payer] += amt;   // payer ka balance badhao
        totals[debtor] -= amt;  // debtor ka kam karo

        ledger[debtor][payer] += amt; // debtor -> payer owed
      }
    }

    /* ---------- settlements apply karo ---------- */
    // har settlement ke liye:
    // - jisne diya uska balance badhao (total mein)
    // - jisne liya uska balance kam karo (total mein)
    // - pair-wise ledger update karo
    // e.g. agar A ne B ko 200 de diye to:
    // totals[A] += 200, totals[B] -= 200
    // ledger[B][A] -= 200 (B ab A ko 200 kam owe karta hai)
    for (const s of settlements) {
      totals[s.paidByUserId] += s.amount;        // jisne diya uska balance +
      totals[s.receivedByUserId] -= s.amount;    // jisne liya uska balance -

      ledger[s.paidByUserId][s.receivedByUserId] -= s.amount; // paise adjust karo
    }

    /* ---------- pair-wise ledger net karo ---------- */
    ids.forEach((a) => {
      ids.forEach((b) => {
        if (a >= b) return; // ek pair sirf ek baar check karo

        const diff = ledger[a][b] - ledger[b][a];
        if (diff > 0) {
          ledger[a][b] = diff; // a owes b
          ledger[b][a] = 0;
        } else if (diff < 0) {
          ledger[b][a] = -diff; // b owes a
          ledger[a][b] = 0;
        } else {
          ledger[a][b] = ledger[b][a] = 0; // dono clear
        }
      });
    });

    /* ---------- final response shape ---------- */
    // har member ke liye:
    // - total balance
    // - owes: kisko aur kitna dena hai
    // - owedBy: kisne aur kitna dena hai
    // e.g. { id: 'user1', totalBalance: 500, owes: [{to: 'user2', amount: 200}], owedBy: [{from: 'user3', amount: 300}] }
    const balances = memberDetails.map((m) => ({
      ...m,
      totalBalance: totals[m.id], // user ka total balance,
      owes: Object.entries(ledger[m.id]) // kisko dena hai
        .filter(([, v]) => v > 0) // only keep record that has to give money
        .map(([to, amount]) => ({ to, amount })),
      owedBy: ids // kisne isko dena hai hai amt
        .filter((other) => ledger[other][m.id] > 0)
        .map((other) => ({ from: other, amount: ledger[other][m.id] })),
    }));

    // quick lookup map for UI
    const userLookupMap = {};
    memberDetails.forEach((member) => {
      userLookupMap[member.id] = member;
    });
  
    // final data return karo
    return {
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
      },
      members: memberDetails,
      expenses,
      settlements,
      balances,
      userLookupMap,
    };
  },
});
