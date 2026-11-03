import { redirect } from "next/navigation";
import { RealScan } from "@/components/scan/real-scan";
import { resolveLabCase } from "@/lib/lab/cases";
import { parseTutorLevel } from "@/lib/tutor/levels";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The scanner needs to know what is being scanned, so it opens with a case
 * from the Lab. Without a valid one the user goes there to pick it.
 */
export default async function ScanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const labCase = resolveLabCase(first(params.case), first(params.context));
  if (!labCase) redirect("/lab");
  return (
    <RealScan labCase={labCase} level={parseTutorLevel(first(params.level))} />
  );
}
