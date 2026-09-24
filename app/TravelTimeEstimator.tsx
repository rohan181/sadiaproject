"use client";

import { useMemo, useState } from "react";
import type { UpazilaAccess } from "./LeafletBoundaryMap";

type UpazilaOption = { shapeID: string; shapeName: string; population_2025: number };

export function TravelTimeEstimator({
  upazilas,
  accessByName,
  onOpenSubdistrict,
}: {
  upazilas: UpazilaOption[];
  accessByName: Record<string, UpazilaAccess> | null;
  onOpenSubdistrict?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...upazilas].sort((a, b) => a.shapeName.localeCompare(b.shapeName)),
    [upazilas],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? sorted.filter((item) => item.shapeName.toLowerCase().includes(q))
      : sorted;
    return pool.slice(0, 8);
  }, [query, sorted]);

  const selected = selectedName
    ? sorted.find((item) => item.shapeName === selectedName)
    : null;
  const access =
    selected && accessByName ? (accessByName[selected.shapeName] ?? null) : null;

  return (
    <div className="travelEstimator" aria-live="polite">
      <div className="estimatorIntro">
        <p className="eyebrow">Travel time estimation</p>
        <h3>Estimate travel time to the nearest facility</h3>
        <p>
          Search any of Bangladesh&rsquo;s 544 real upazilas to see its
          network-modeled travel time to the nearest mapped healthcare
          facility.
        </p>
      </div>
      <div className="estimatorSearch">
        <input
          type="text"
          value={query}
          placeholder="Search an upazila, e.g. Abhaynagar"
          aria-label="Search upazila for a travel time estimate"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedName(null);
          }}
        />
        {!selected && (
          <ul className="estimatorSuggestions">
            {matches.length === 0 && <li className="empty">No matching upazila</li>}
            {matches.map((item) => (
              <li key={item.shapeID}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedName(item.shapeName);
                    setQuery(item.shapeName);
                  }}
                >
                  {item.shapeName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected && (
        <div className="estimatorResult">
          <div className="estimatorResultHead">
            <h4>{selected.shapeName} Upazila</h4>
            <button
              type="button"
              className="estimatorClear"
              onClick={() => {
                setSelectedName(null);
                setQuery("");
              }}
              aria-label="Clear selected upazila"
            >
              Change ×
            </button>
          </div>
          {access?.mean_travel_minutes != null ? (
            <>
              <div className="estimatorHeadline">
                <strong>{access.mean_travel_minutes.toFixed(1)}</strong>
                <span>estimated minutes, dry season</span>
              </div>
              <p className="estimatorSummary">
                An estimated{" "}
                <b>
                  {access.underserved_percent != null
                    ? `${access.underserved_percent.toFixed(1)}%`
                    : "—"}
                </b>{" "}
                of {selected.population_2025.toLocaleString()} residents live
                beyond a 30-minute network reach of a mapped facility.
              </p>
            </>
          ) : (
            <p className="estimatorNoData">
              No modeled route is available for this upazila &mdash; it sits
              on a disconnected fragment of the mapped road network.
            </p>
          )}
          <p className="estimatorMethod">
            Estimate = shortest pgRouting-modeled travel time from a
            representative point in the upazila to the nearest mapped
            facility, using real OSM road classes and dry-season speeds. This
            is a network model, not a live GPS ETA — monsoon estimates are
            not yet published.
          </p>
          {onOpenSubdistrict && (
            <button type="button" className="estimatorOpenMap" onClick={onOpenSubdistrict}>
              See it on the upazila map <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
