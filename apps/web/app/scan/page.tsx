import { redirect } from "next/navigation";
import { RealScan } from "@/components/scan/real-scan";
import { resolveLabCase } from "@/lib/lab/cases";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * The scanner needs to know what is being scanned, so it opens with a case
 * from the Laboratorio. Without a valid one the user goes there to pick it.
 */
export default async function ScanPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const labCase = resolveLabCase(first(params.caso), first(params.contexto));
  if (!labCase) redirect("/laboratorio");
  return <RealScan labCase={labCase} />;
}
