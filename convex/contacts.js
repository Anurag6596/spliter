// convex/contacts. api bnao 
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";


//   1. getAllContacts – 1-to-1 expense contacts + groups

export const getAllContacts = query({
  handler: async (ctx) => {
    // Centralized getCurrentUser call se current logged-in user ka data lao
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    //Personal expenses jisme aap payer ho 
    const expensesYouPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", currentUser._id).eq("groupId", undefined) // groupId undefined → 1-to-1 expense
      )
      .collect();

    //Personal expenses jisme aap payer nahi ho 
    const expensesNotPaidByYou = (
      await ctx.db
        .query("expenses")
        .withIndex("by_group", (q) => q.eq("groupId", undefined)) // sirf 1-to-1 wale
        .collect()
    ).filter(
      (e) =>
        e.paidByUserId !== currentUser._id && // aap payer nahi ho
        e.splits.some((s) => s.userId === currentUser._id) // split me aap ho
    );

    // Dono type ke expenses ko ek saath merge karo
    const personalExpenses = [...expensesYouPaid, ...expensesNotPaidByYou];

    // Unique contact IDs nikaalo 
    const contactIds = new Set();

    personalExpenses.forEach((exp) => {
      // Agar current user payer nahi hai toh payer ka ID add karo
      if (exp.paidByUserId !== currentUser._id)
        contactIds.add(exp.paidByUserId);

      // Har split ka user ID check karo, agar current user nahi hai toh add karo
      exp.splits.forEach((s) => {
        if (s.userId !== currentUser._id) contactIds.add(s.userId);
      });
    });

    //  Contact users ka data DB se lao 
    const contactUsers = await Promise.all(
      [...contactIds].map(async (id) => {
        const u = await ctx.db.get(id);
        return u
          ? {
              id: u._id,
              name: u.name,
              email: u.email,
              imageUrl: u.imageUrl,
              type: "user", // type "user" rakha taki group se differentiate ho
            }
          : null;
      })
    );

    //  Groups jisme current user member hai
    const userGroups = (await ctx.db.query("groups").collect())
      .filter((g) => g.members.some((m) => m.userId === currentUser._id))
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
        type: "group",
      }));

    //Alphabetical sorting 
    contactUsers.sort((a, b) => a?.name.localeCompare(b?.name));
    userGroups.sort((a, b) => a.name.localeCompare(b.name));

    // Null hata ke clean users aur groups return karo
    return { users: contactUsers.filter(Boolean), groups: userGroups };
  },
});


  //  2. createGroup – Naya group create karo

export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Centralized getCurrentUser call se current logged-in user ka data lao
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // Group ka naam empty nahi ho sakta
    if (!args.name.trim()) throw new Error("Group name cannot be empty");

    // Members ka set banao aur creator ka ID add karo
    const uniqueMembers = new Set(args.members);
    uniqueMembers.add(currentUser._id);

    // Har member ka existence validate karo
    for (const id of uniqueMembers) {
      if (!(await ctx.db.get(id)))
        throw new Error(`User with ID ${id} not found`);
    }

    // Naya group DB me insert karo
    return await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      createdBy: currentUser._id,
      members: [...uniqueMembers].map((id) => ({
        userId: id,
        role: id === currentUser._id ? "admin" : "member", // creator = admin
        joinedAt: Date.now(),
      })),
    });
  },
});
