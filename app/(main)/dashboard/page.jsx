"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { ChevronRight, PlusCircle, Users } from "lucide-react";
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
    <div className="container mx-auto py-10 space-y-8">
      {isLoading ? (
        <div className="w-full py-16 flex justify-center">
          <BarLoader width={"100%"} color="#36d7b7" />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-extrabold gradient-title bg-clip-text text-transparent">
              Dashboard
            </h1>

            <Button asChild className="shadow-md hover:scale-105 transition">
              <Link href="/expenses/new">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Expense
              </Link>
            </Button>
          </div>

          {/* Balances Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-sm hover:shadow-lg transition rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {balances.totaBalance > 0 ? (
                    <span className="text-green-600">
                      +${balances?.totalBalance.toFixed(2)}
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-red-600">
                      -${Math.abs(balances?.totalBalance).toFixed(2)}
                    </span>
                  ) : (
                    <span>$0.00</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {balances?.totalBalance > 0
                    ? "You are owed money"
                    : balances?.totalBalance < 0
                    ? "You owe money"
                    : "All settled up"}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-lg transition rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You are owed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  ${balances?.youAreOwed.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {balances?.oweDetails?.youAreOwedBy?.length || 0} people
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-lg transition rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You owe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balances?.oweDetails?.youOwe?.length > 0 ? (
                  <>
                    <div className="text-3xl font-bold text-red-600">
                      ${balances?.youOwe.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To {balances?.oweDetails?.youOwe?.length || 0} people
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-bold">$0.00</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You don’t owe anyone
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Dashboard Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              <ExpenseSummary
                monthlySpending={monthlySpending}
                totalSpent={totalSpent}
              />
            </div>

            {/* Right */}
            <div className="space-y-6">
              <Card className="shadow-sm hover:shadow-md rounded-xl transition">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-semibold">
                      Balance Details
                    </CardTitle>
                    <Button variant="link" asChild className="p-0 text-sm">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <BalanceSummary balances={balances} />
                </CardContent>
              </Card>

              <Card className="shadow-sm hover:shadow-md rounded-xl transition">
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-semibold">Your Groups</CardTitle>
                    <Button variant="link" asChild className="p-0 text-sm">
                      <Link href="/contacts">
                        View all
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <GroupList groups={groups} />
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    asChild
                    className="w-full hover:bg-muted"
                  >
                    <Link href="/contacts?createGroup=true">
                      <Users className="mr-2 h-4 w-4" />
                      Create new group
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default DashboardPage;
