import Link from "next/link";
import StudentLogin from "@/components/student/student-login";

export default async function StudentLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="student-page student-account-page">
    <header className="student-header"><Link href="/" className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></Link><Link className="student-shop-link" href="/">Back to order</Link></header>
    <StudentLogin linkError={error === "link"} />
  </main>;
}
