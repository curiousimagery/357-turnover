"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordPayment } from "@/app/turnover/actions";

/** Admin payment control for a turnover: set the amount, mark paid/unpaid. */
export function PaymentControls({
  turnoverId,
  initialAmount,
  initialPaid,
}: {
  turnoverId: string;
  initialAmount: number | null;
  initialPaid: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    initialAmount != null ? String(initialAmount) : "",
  );
  const [paid, setPaid] = useState(initialPaid);
  const [pending, startTransition] = useTransition();

  function save(markPaid: boolean) {
    const amt = amount.trim() === "" ? null : Number(amount);
    if (amt != null && (Number.isNaN(amt) || amt < 0)) {
      toast.error("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const result = await recordPayment({ turnoverId, amount: amt, paid: markPaid });
      if (result.ok) {
        setPaid(markPaid);
        toast.success(markPaid ? "Marked paid" : "Saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-14 text-body"
          placeholder="120"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {paid ? (
          <>
            <span className="text-body font-semibold text-success">Paid</span>
            <Button
              size="touch"
              variant="outline"
              disabled={pending}
              onClick={() => save(false)}
            >
              Mark unpaid
            </Button>
          </>
        ) : (
          <>
            <Button size="touch" disabled={pending} onClick={() => save(true)}>
              Mark paid
            </Button>
            <Button
              size="touch"
              variant="outline"
              disabled={pending}
              onClick={() => save(false)}
            >
              Save amount
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
