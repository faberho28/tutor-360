import { notFound } from "next/navigation";
import { StepsLab } from "@/components/lab/steps-lab";

/** Development only: a bench to tune the prompts one stage at a time. */
export default function LabStepsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StepsLab />;
}
