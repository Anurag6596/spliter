// api for aal the contacts related operations

import { convexToJson, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getAllContacts = query({
  //ye function sabhi contacts ko fetch karega jo one on one hai or jo group me hai
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser); // ye internal query hai jo internal run hoti hai and we can use it to get the current user again and again

    const expensesYouPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) => {
        // ye index use karega jo paidByUserId and groupId ke basis pe expenses ko fetch karega
        q.eq("paidByUserId", currentUser._id).eq("groupId", undefined);
      })
      .collect(); // collect() function use karega to get all the expenses you paid

    const expensesNotPaidByYou = (
      await ctx.db
        .query("expenses")
        .withIndex("by_group", (q) => {
          // ye index use krega jo paise apne nhi pay kiye hai or the payment not done by you
          q.eq("groupId", undefined);
        })
        .collect()
    ).filter(
      (e) =>
        e.paidByUserId !== currentUser._id &&
        e.splits.some((s) => s.userId === currentUser._id)
    ); // Pehle saare items collect karo, phir sirf unko rakhna jisme paidByUserId current user ka ID na ho aur splits present ho

    const personalExpenses = [...expensesYouPaid, ...expensesNotPaidByYou]; // combine krega jo expenses pay kiya hia ya nahi kiye hai

    const contactIds = new Set();
    personalExpenses.forEach((exp) => {
      if (exp.paidByUserId != currentUser._id) contactIds.add(exp.paidByUserId); // Agar expense current user ne pay nahi kiya, toh uska paidByUserId contact list me add karo

      exp.splits.forEach((s) => {
        if (s.userId != currentUser._id) contactIds.add(s.userId); // Har split check karo, agar userId current user ka nahi hai toh usko contact list me add karo
      });
    });

    const contactuser = await Promise.all(
      [...contactIds].map(async (id) => {
        const u = await ctx.db.get(id);

        return u // Har contactId ke liye DB se user details lao, agar user mila toh uska info object banao, warna null return karo
          ? {
              id: u._id,
              name: u.name,
              email: u.email,
              imageurl: u.imageUrl,
              type: "user", // add a type marker to distinguish from groups
            }
          : null;
      })
    );

    const userGroups = (await ctx.db.query("groups").collect())
      .filter((g) => g.members.some((m) => m.userId === currentUser._id)) // DB se saare groups lao, phir filter karo jisme current user member hai
      .map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description,
        memberCount: g.members.length,
        type: "group",
      })); // Us group ka basic info object banao (id, name, description, member count, type)// Us group ka basic info object banao (id, name, description, member count, type)

    // Alphabetically sort karo: pehle users, phir groups
    contactuser.sort((a, b) => a?.name.localeCompare(b?.name)); // Null entries hatao users list se
    userGroups.sort((a, b) => a.name.localeCompare(b.name));

    return { users: contactuser.filter(Boolean), groups: userGroups }; // Users aur groups ka object return karo
  },
});


export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    members: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    // Use the centralized getCurrentUser instead of duplicating auth logic
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    if (!args.name.trim()) throw new Error("Group name cannot be empty");

    const uniqueMembers = new Set(args.members);
    uniqueMembers.add(currentUser._id); // ensure creator

    // Validate that all member users exist
    for (const id of uniqueMembers) {
      if (!(await ctx.db.get(id)))
        throw new Error(`User with ID ${id} not found`);
    }

    return await ctx.db.insert("groups", { //Groups table me naya group insert karo:
      name: args.name.trim(), // Name aur description trim karke store karo
      description: args.description?.trim() ?? "", 
      createdBy: currentUser._id, // createdBy me current user ka ID daalo
      members: [...uniqueMembers].map((id) => ({ // members list me har unique member ka object banao, 
        userId: id,
        role: id === currentUser._id ? "admin" : "member", // agar current user hai toh role "admin" warna "member" set karo,
        joinedAt: Date.now(), // joinedAt me current time save karo
      })),
    });
  },
});