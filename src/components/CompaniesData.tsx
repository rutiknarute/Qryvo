import { useState } from "react";
import { ArrowSquareOut, Buildings, CaretDown } from "@phosphor-icons/react";
import { displayGroupName } from "../core";
import type { Group } from "../core";

export default function CompaniesData({ groups }: { groups: Group[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <div className="page-heading">
        <h1>Companies Data</h1>
        <p>Click a group to see the companies attached to its saved URL.</p>
      </div>
      <p className="company-data-note">
        Company names weren’t included in the supplied files. Each company ID
        links to its LinkedIn page.
      </p>
      <div className="company-data-list">
        {groups.map((group) => {
          const expanded = openId === group.id;
          const panelId = `company-data-${group.id}`;
          return (
            <section className="panel company-data-group" key={group.id}>
              <h2>
                <button
                  className="company-data-toggle"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setOpenId(expanded ? null : group.id)}
                >
                  <Buildings size={21} />
                  <span>{displayGroupName(group)}</span>
                  <CaretDown size={18} className={expanded ? "expanded" : ""} />
                </button>
              </h2>
              {expanded && (
                <div
                  id={panelId}
                  role="region"
                  aria-label={`${displayGroupName(group)} companies`}
                  className="company-data-panel"
                >
                  <a
                    className="company-data-source"
                    href={group.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View original URL <ArrowSquareOut size={15} />
                  </a>
                  <ul className="company-directory">
                    {group.company_ids.map((id, index) => (
                      <li key={`${id}-${index}`}>
                        <a
                          href={`https://www.linkedin.com/company/${id}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>
                            Company ID <strong>{id}</strong>
                          </span>
                          <ArrowSquareOut size={15} />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
