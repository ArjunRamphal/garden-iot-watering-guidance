#!/usr/bin/env python3

import argparse
import csv
import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


def timestamp(text):
    result = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("A timestamp must include Z or a timezone offset")
    return result.astimezone(timezone.utc)


def load(path, required):
    with Path(path).open(newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"{path}: missing columns {required-set(reader.fieldnames or [])}")
        return list(reader)


def stats(values):
    if not values:
        return "no values"
    return (f"n={len(values)}, mean={statistics.mean(values):.3f}, "
            f"median={statistics.median(values):.3f}, "
            f"sample SD={statistics.stdev(values):.3f}, "
            f"min={min(values):.3f}, max={max(values):.3f}") if len(values)>1 else f"n=1, value={values[0]:.3f}, SD undefined"


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--readings", required=True)
    parser.add_argument("--watering")
    parser.add_argument("--start", help="Inclusive ISO timestamp with timezone")
    parser.add_argument("--end", help="Exclusive ISO timestamp with timezone")
    parser.add_argument("--allow-simulated", action="store_true")
    args=parser.parse_args()
    start=timestamp(args.start) if args.start else None
    end=timestamp(args.end) if args.end else None
    if start and end and start>=end:
        raise ValueError("End must be after start")
    def selected(row):
        at=timestamp(row["at"])
        return (start is None or at>=start) and (end is None or at<end)
    all_rows=load(args.readings,{"at","source","raw","moisture_index","calibration_id","stream_id","seq","state","flags"})
    rows=[r for r in all_rows if selected(r)]
    if not rows:
        raise ValueError("No readings in this time window")
    sources={r["source"] for r in rows}
    if sources!={"hardware"} and not args.allow_simulated:
        raise ValueError("Input is not exclusively hardware data. Only use --allow-simulated for labelled software practice.")
    print("COMP717A EXPORTED-DATA SUMMARY")
    print("Sources:",", ".join(sorted(sources)))
    print("UTC range:",min(r["at"] for r in rows),"to",max(r["at"] for r in rows))
    print("Raw ADC:",stats([int(r["raw"]) for r in rows]))
    profiles=defaultdict(list)
    for row in rows:
        if row["moisture_index"]:
            profiles[row["calibration_id"]].append(float(row["moisture_index"]))
    for profile,values in profiles.items():
        print(f"Relative index, profile {profile}:",stats(values))
    print("Stored reading states:",dict(Counter(r["state"] for r in rows)))
    print("Flagged readings:",sum(bool(r["flags"]) for r in rows))
    streams=defaultdict(set)
    for row in rows:
        streams[row["stream_id"]].add(int(row["seq"]))
    received=sum(len(s) for s in streams.values())
    expected=sum(max(s)-min(s)+1 for s in streams.values())
    print(f"Observed within-stream sequence completeness: {received}/{expected} = {100*received/expected:.3f}%")
    print("This excludes time outside each observed stream, including disconnected periods. It is not uptime.")
    if args.watering:
        water=[r for r in load(args.watering,{"at","source","volume_ml"}) if selected(r)]
        if any(r["source"] not in sources for r in water):
            raise ValueError("Watering and reading sources do not match")
        values=[float(r["volume_ml"]) for r in water]
        if any(not math.isfinite(x) or x<=0 for x in values):
            raise ValueError("Invalid applied volume in watering export")
        print(f"Watering records in selected window: {len(water)}; operator-reported measured water: {sum(values):.3f} mL")
        if not start or not end:
            print("No complete trial window specified: totals may include preparation/calibration water.")
    print("Use a stable sample window for repeatability. No VWC accuracy, water saving or yield result is inferred.")


if __name__=="__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as exc:
        raise SystemExit(f"Analysis error: {exc}")
