"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateBusinessModal } from "./create-business-modal";

export function CreateBusinessButton({
  className = "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition cursor-pointer",
  label = "+ Add Business",
}: {
  className?: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <span>🏢</span>
        <span>{label}</span>
      </button>

      <CreateBusinessModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </>
  );
}
