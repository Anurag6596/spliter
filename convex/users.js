import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const store = mutation({  //ye data ko manipulate krne k liye use kiya hai
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();  //clerk ka use krega to get user identity
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }
    //check kiya ki identity already store kiya h ki nhi
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      //agar user ki identity phle se pta but nme changed hai toh uski valut ko mila denge using patch() function
      if (user.name !== identity.name) {
        await ctx.db.patch(user._id, { name: identity.name });
      }
      return user._id;
    }
    //aur  agar naya user  hai toh new user create krenge
    return await ctx.db.insert("users", {
      name: identity.name ?? "Anonymous",
      tokenIdentifier: identity.tokenIdentifier,
      email: identity.email,
      imageUrl: identity.pictureUrl,
    });
  },
});

export const getCurrentUser = query({
  handler: async (ctx)=>{
    const identity = await ctx.auth.getUserIdentity(); // ye current user ki identity ko fetch karega
    if(!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db // ye user ko fetch karega using identity
      .query("users")
      .withIndex("by_token", (q) => {
        return q.eq("tokenIdentifier", identity.tokenIdentifier);
      })
      .first();

      // agar user nahi mila toh error throw karega
      if(!user) {
        throw new Error("User not found");
      }
      return user;
  },
})


export const searchUsers = query({
  args: {query: v.string() },
  handler:async(ctx, args)=>{
    // Centralized function se current user nikal rahe hain
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);


    // Agar query bahut chhoti hai (<2 letters), to search mat karo
    if (args.query.length < 2) {
      return [];
    }

     // Users collection me search karo by "name"
    // Yaha pe humne "search_name" index banaya hai usko use kar rahe hain
    const nameResults = await ctx.db
      .query("users")
      .withSearchIndex("search_name", (q) => q.search("name", args.query))
      .collect();

      // Users collection me query kar rahe hain
    const emailResults = await ctx.db
      .query("users")
      // "search_email" index use karke email field pe search karenge
      .withSearchIndex("search_email",(q)=> q.search("email", args.query))
      //results ko collect krke array me le aayenge 
      .collect()


    const users = [
      ...nameResults,
      ...emailResults.filter(
        (email)=> !nameResults.some((name)=> name._id === email._id)
      ),
    ];

    // Exclude current user and format results
     return users
      .filter((user) => user._id !== currentUser._id)
      .map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      }));
  },
})