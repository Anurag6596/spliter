"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import React from "react";
import { BarLoader } from "react-spinners";
import ExpenseSummary from "./components/expense-summary";
import BalanceSummary from "./components/balance-summary";
import GroupList from "./components/group-list";

const DashboardPage = () => {
  const { data: balances, isLoading: balancesLoading } = useConvexQuery(
    api.dashboard.getUserBalances
  );

  const { data: groups, isLoading: groupsLoading } = useConvexQuery(
    api.dashboard.getUserGroups
  );

  const { data: totalSpent, isLoading: totalSpentLoading } = useConvexQuery(
    api.dashboard.getTotalSpent
  );

  const { data: monthlySpending, isLoading: monthlySpendingLoading } =
    useConvexQuery(api.dashboard.getMonthlySpending);

  const isLoading =
    balancesLoading ||
    groupsLoading ||
    totalSpentLoading ||
    monthlySpendingLoading;

  return (
    <div>
      {isLoading ? (
        <div className="w-full py-12 flex justify-center">
          <BarLoader width={"100%"} color="#36d7b7" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-5xl gradient-title">Dashboard</h1>

            <Button asChild>
              <Link href="/expenses/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Balances
                </CardTitle>
                <CardAction>Card Action</CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {balances.totaBalance > 0 ? (
                    <span className="text-green-500">
                      +${balances?.totalBalance.toFixed(2)}
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-red-500">
                      -${Math.abs(balances?.totalBalance).toFixed(2)}
                    </span>
                  ) : (
                    <span>$0.00</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {balances?.totalBalance > 0
                   ? "you are owed money"
                   : balances?.totalBalance < 0
                    ? "you owe money"
                    : "all settled up"}
                  
                </p>
              </CardContent>
            </Card>
              {/* how much you are owed  */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You are owed
                </CardTitle>
                <CardAction>Card Action</CardAction>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  ${balances?.youAreOwed.toFixed(2)}
                </div>
                <p className=" text-xs text-muted-foreground mt-1">
                  From {balances?.oweDetails?.youAreOwedBy?.length || 0} People
                </p>
              </CardContent>
            </Card>

            {/* you owe  */}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You owe
                </CardTitle>
                <CardAction>Card Action</CardAction>
              </CardHeader>
              <CardContent>
                {balances?.oweDetails?.youOwe?.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-red-600">
                      ${balances?.youOwe.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To {balances?.oweDetails?.youOwe?.length || 0} people
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">$0.00</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You don't owe anyone
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 grid-cols-3 gpa-6">
            {/* left cols */}
                <div className="lg:cols-span-2 space-y-6">
                  {/* Expense summary \ */}
                  <ExpenseSummary 
                  monthlySpending={monthlySpending}
                  totalSpent={totalSpent}
                  />
                </div>

            {/* right cols */}
            <div className="sapce-y-6 ">
              {/* balance details */}
              <Card>
              <CardHeader className="pb-2">
                <CardTitle>
                  Balance Details
                </CardTitle>
                <CardAction>Card Action</CardAction>
              </CardHeader>
              <CardContent>
               
              </CardContent>
            </Card>

              {/* groups */}
              <GroupList />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
