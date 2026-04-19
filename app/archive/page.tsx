import Link from "next/link";
import { local001 } from "@/lib/local-001";

export default function ArchivePage() {
  return (
    <section className="section">
      <p className="eyebrow">Archive</p>
      <h1>Issued Locals</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Local</th>
            <th>Concept</th>
            <th>Status</th>
            <th>Edition</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Link href="/locals/001">001</Link>
            </td>
            <td>{local001.concept}</td>
            <td>{local001.status}</td>
            <td>{local001.editionCount}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
