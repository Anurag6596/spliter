import { mutation } from "./_generated/server";

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