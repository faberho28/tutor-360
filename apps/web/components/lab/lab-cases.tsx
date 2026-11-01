"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomCaseCard } from "@/components/lab/custom-case-card";
import { CARD_CLASS, LabCardBody } from "@/components/lab/lab-card";
import { LevelPicker } from "@/components/lab/level-picker";
import { LAB_CASES, scanHref } from "@/lib/lab/cases";
import { DEFAULT_TUTOR_LEVEL, type TutorLevel } from "@/lib/tutor/levels";

/** The level of the reader and the cases to scan: the level travels with the case. */
export function LabCases() {
  const [level, setLevel] = useState<TutorLevel>(DEFAULT_TUTOR_LEVEL);

  return (
    <>
      <LevelPicker value={level} onChange={setLevel} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LAB_CASES.map((labCase) => (
          <li key={labCase.id}>
            {labCase.id === "personalizado" ? (
              <CustomCaseCard labCase={labCase} level={level} />
            ) : (
              <Link href={scanHref(labCase.id, level)} className={CARD_CLASS}>
                <LabCardBody labCase={labCase} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
