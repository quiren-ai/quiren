import Link from "next/link";
import { Mark } from "@/components/brand";
import { SiteHeader } from "@/components/quiren/site-frame";

export default function NotFound() {
  return (
    <div className="ix-page">
      <SiteHeader light />
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <Mark tone="light" className="mx-auto size-12" />
          <h1 className="mt-6 text-[40px] leading-none">Nothing kept here.</h1>
          <p className="mt-4 text-[15px]">The page you asked for does not exist.</p>
          <Link href="/" className="ix-btn black mt-8">
            Back to the start
          </Link>
        </div>
      </main>
    </div>
  );
}
